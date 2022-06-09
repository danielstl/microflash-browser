import {MicroflashFilesystem} from "@/filesystem/codalfs/MicroflashFilesystem";
import {MemorySpan} from "@/filesystem/utils/MemorySpan";
import {BlockInfoFlag} from "@/filesystem/codalfs/BlockInfoFlag";
import {BlockType} from "@/filesystem/codalfs/BlockType";
import {MicroDirectoryEntry} from "@/filesystem/codalfs/MicroDirectoryEntry";
import {MicroDirectory} from "@/filesystem/codalfs/MicroDirectory";
import {DirectoryEntryFlag} from "@/filesystem/codalfs/DirectoryEntryFlag";
import {FlashWritable} from "@/filesystem/core/FlashWritable";
import {CODALFS_MAGIC} from "@/filesystem/utils/Constants";

export class FlashManager {

    flashStart = 0;
    pageSize = this.filesystem.metadata.pageSize;
    blockSize = this.filesystem.metadata.blockSize;
    flashSize = this.filesystem.metadata.flashSize;

    dataView: DataView;
    originalData: ArrayBuffer;

    lastBlockAllocated = 0;

    constructor(public filesystem: MicroflashFilesystem, public data: ArrayBuffer) {
        this.filesystem = filesystem;
        this.dataView = new DataView(this.data);

        this.originalData = new ArrayBuffer(this.data.byteLength);
        const wrapper = new DataView(this.originalData);

        for (let i = 0; i < this.data.byteLength; i++) { // create a copy of the active data
            wrapper.setInt8(i, this.dataView.getInt8(i));
        }
    }

    private static handleFilesystemChange() {
        window.dispatchEvent(new CustomEvent("microbit-fs-dirty"));
    }

    get changesAsPatches(): Patch[] {
        // go through bytes 1 by 1
        const original = new DataView(this.originalData);

        /**
         * Patches
         *
         * Stored back to back in memory
         * Each patch is as follows:
         * [ Patch position (2 bytes) ] [ Patch length (2 bytes) ] [ Patch data ('patch length' bytes) ]
         */

        const allPatches = new Array<Patch>();

        let currentPatchStart = -1;
        let currentPatch = new ArrayBuffer(original.byteLength);
        let currentPatchLength = 0;

        const clearPages = this.pagesToClear;

        for (let i = 0; i < this.originalData.byteLength; i++) {
            const originalByte = original.getUint8(i);
            const newByte = this.dataView.getUint8(i);

            const inPageEraseRegion = clearPages.some(pageAddress => i >= pageAddress && i < pageAddress + this.pageSize);

            if (originalByte == newByte && !inPageEraseRegion) { // unchanged

                if (currentPatchStart !== -1) { // end our current patch!

                    allPatches.push(new Patch(currentPatchStart, currentPatch.slice(0, currentPatchLength)));

                    currentPatchStart = -1;
                    currentPatchLength = 0;
                    currentPatch = new ArrayBuffer(original.byteLength - i);

                }
            } else { // changed

                if (currentPatchStart === -1) { // create a new patch
                    currentPatchStart = i;
                    currentPatchLength = 0;
                }

                new DataView(currentPatch).setUint8(currentPatchLength, newByte); // add to patch
            }

            currentPatchLength++;
        }

        if (currentPatchStart !== -1) { // end our final patch!

            allPatches.push(new Patch(currentPatchStart, currentPatch.slice(0, currentPatchLength)));
        }

        // clear all empty patches! empty flash is already filled with this :)
        return allPatches.filter(patch => !new MemorySpan(patch.data).isFilledWith(0xFF));
    }

    applyPatch(patch: MemorySpan) {
        if (patch.data.byteLength == 0) {
            return;
        }

        const dataAsArray = new Uint8Array(this.data);

        while (!patch.complete) {
            const patchPos = patch.readUint32();
            const patchLength = patch.readUint8();

            const patchData = new Uint8Array(patch.readArrayBufferSlice(patchLength));

            dataAsArray.set(patchData, patchPos);
        }
    }

    get blocksPerPage(): number {
        return Math.floor(this.pageSize / this.blockSize);
    }

    getBlock(blockIndex: number): MemorySpan {
        return this.getMemorySpan(this.flashStart + blockIndex * this.blockSize, this.blockSize);
    }

    getMemorySpan(source: number, length: number): MemorySpan {
        return new MemorySpan(new DataView(this.data, source, length), FlashManager.handleFilesystemChange);
    }

    erase(source: number, length: number) {
        const range = new Uint8Array(this.data);

        range.fill(BlockInfoFlag.Unused, source, source + length);
        FlashManager.handleFilesystemChange();
    }

    erasePage(page: number) {
        this.erase(page * this.blocksPerPage * this.blockSize, this.pageSize);
    }

    getBlockAddress(blockIndex: number): number {
        return blockIndex * this.blockSize;
    }

    getPageAddress(blockIndex: number): number {
        const address = this.getBlockAddress(blockIndex);
        return (address - address % this.pageSize);
    }

    getFreeBlockIndex(): number {
        let block: number;
        let deletedBlock = 0;

        for (block = (this.lastBlockAllocated + 1) % this.flashSize; block != this.lastBlockAllocated; block++) {

            const blockStatus = this.filesystem.fileAllocationTable.getBlockInfo(block);

            if (blockStatus == BlockInfoFlag.Unused) {
                this.lastBlockAllocated = block;

                // If this is the first block used in a page that it marked entirely as free,
                // then ensure the physical page is erased before use.
                const firstBlock = block - block % this.blocksPerPage;

                let needsErase = true;

                // Go through all blocks in this page to check if any aren't unused.
                // If none are used, we don't need to erase it.
                for (let existingBlock = firstBlock; existingBlock < firstBlock + this.blocksPerPage; existingBlock++) {
                    if (this.filesystem.fileAllocationTable.getBlockInfo(existingBlock) != BlockInfoFlag.Unused) {
                        needsErase = false;
                        break;
                    }
                }

                if (needsErase) {
                    this.erasePage(this.getPageAddress(block));
                }

                return block;
            }

            if (blockStatus == BlockInfoFlag.Deleted) {
                deletedBlock = block;
            }
        }

        // If no UNUSED blocks are available, try to recycle one marked as DELETED.
        block = deletedBlock;

        // If no blocks are available - either UNUSED or marked as DELETED, then we're out of space and
        // there's nothing we can do.
        if (block) {
            // recycle the FileTable, such that we can mark all previously deleted blocks as re-usable.
            // Better to do this in bulk, rather than on a block by block basis to improve efficiency.
            this.filesystem.fileAllocationTable.recycle();

            // Record the block we just allocated, so we can round-robin around blocks for load
            // balancing.
            this.lastBlockAllocated = block;
        }

        return block;
    }

    get pagesToClear(): number[] {
        // Go through flash, find any with regions whereby a flash clear will be needed
        // due to how the flash memory works

        const original = new DataView(this.originalData);
        const pages: number[] = [];

        for (let i = 0; i < this.originalData.byteLength; i++) {
            const originalByte = original.getUint8(i);
            const newByte = this.dataView.getUint8(i);

            // Check if these changes would require a flash clear to be valid
            if ((originalByte ^ newByte) & newByte) {
                const pageAddress = this.getContainingPage(i) * this.pageSize;

                pages.push(pageAddress);

                i = pageAddress + this.pageSize; // jump to the next page
            }
        }

        return pages;
    }

    getContainingPage(address: number): number {
        return Math.floor((address - this.flashStart) / this.pageSize);
    }

    getContainingBlockIndex(address: number): number {
        return Math.floor((address - this.flashStart) / this.blockSize);
    }

    recyclePage(blockIndex: number, type: BlockType = BlockType.File) {

        const page = this.getPageAddress(blockIndex);

        // Scratch holds our current state whilst in the middle of recycling
        const scratch = MemorySpan.empty(this.pageSize);

        let currentBlockIndex = this.getContainingBlockIndex(page);
        let scratchWritePos = 0;

        console.log(`Recycling page ${page}...`);

        for (let i = 0; i < this.blocksPerPage; i++) {
            let freeBlock = false;

            const blockInfo = this.filesystem.fileAllocationTable.getBlockInfo(currentBlockIndex);

            if (blockInfo == BlockInfoFlag.Deleted || blockInfo == BlockInfoFlag.Unused) {
                // If we have an unused or deleted block, there's nothing to do - allow the block to be recycled.

                freeBlock = true;

            } else if (currentBlockIndex == blockIndex && type == BlockType.Directory) {
                // If we have been asked to recycle a valid directory block, recycle individual entries where possible.

                const entry = MicroDirectoryEntry.readFromBlock(this.filesystem, null, currentBlockIndex);
                const dir = MicroDirectory.readFromDirectoryEntry(this.filesystem, entry, true);

                if (entry.fileName == CODALFS_MAGIC) {
                    entry.writeToFlash(scratch);
                }

                dir.entries.forEach(entry => {
                    // If the entry is not valid, we don't want to save it!
                    if ((entry as MicroDirectoryEntry).hasFlags(DirectoryEntryFlag.New)) {
                        return;
                    }

                    // Save this directory entry
                    entry.writeToFlash(scratch);
                });

            } else if (currentBlockIndex < this.filesystem.fileAllocationTable.fileTableSize) {
                // All blocks before the root directory are the FileTable.
                // Recycle any entries marked as DELETED to UNUSED.

                const block = this.getBlock(currentBlockIndex);

                // Go through this block, 16-bit integer at a time. Each represents
                // a file allocation table entry.
                while (block.canRead(2)) {
                    const entry = block.readUint16();

                    if (entry != BlockInfoFlag.Deleted) {
                        // Save this, as it's valid
                        scratch.writeUint16(entry);
                    }
                }

            } else {
                // Copy all other VALID blocks directly into the scratch page.
                scratch.write(this.getBlock(currentBlockIndex));
            }

            // Go to the next block!
            currentBlockIndex++;

            scratchWritePos += this.blockSize;
            scratch.atOffset(scratchWritePos);
        }

        // Tell the micro:bit to clear this page when we write back to it...
       // this.forceRewritePages.push(page);

        // eslint-disable-next-line no-debugger
        debugger;

        // Write our scratch to the page...
        this.getMemorySpan(page, this.pageSize).write(scratch);
    }
}

export class Patch implements FlashWritable {

    constructor(public position: number, public data: ArrayBuffer) {

    }

    public split(atSize: number): Patch[] {
        const res: Patch[] = [];

        if (this.data.byteLength <= atSize) {
            res.push(this);
            return res;
        }

        for (let i = 0; i < this.data.byteLength; i += atSize) {
            res.push(new Patch(this.position + i, this.data.slice(i, i + atSize)));
        }

        return res;
    }

    writeToFlash(flash: MemorySpan): void {
        flash.writeUint32(this.position);
        flash.writeUint8(this.data.byteLength);
        flash.write(new MemorySpan(this.data));
    }
}