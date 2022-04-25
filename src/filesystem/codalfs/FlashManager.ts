import {MicroflashFilesystem} from "@/filesystem/codalfs/MicroflashFilesystem";
import {MemorySpan} from "@/filesystem/utils/MemorySpan";
import {BlockInfoFlag} from "@/filesystem/codalfs/BlockInfoFlag";
import {BlockType} from "@/filesystem/codalfs/BlockType";
import {MicroDirectoryEntry} from "@/filesystem/codalfs/MicroDirectoryEntry";
import {MicroDirectory} from "@/filesystem/codalfs/MicroDirectory";
import {DirectoryEntryFlag} from "@/filesystem/codalfs/DirectoryEntryFlag";

export class FlashManager {

    flashStart = 0;
    flashEnd = 0;
    pageSize = 1024;
    blockSize = 512;
    flashSize = 131072;

    dataView: DataView;
    originalData: ArrayBuffer

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

    get changesAsPatch(): MemorySpan {
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
        let currentPatch = new Array<number>();

        for (let i = 0; i < this.originalData.byteLength; i++) {
            const originalByte = original.getInt8(i);
            const newByte = this.dataView.getInt8(i);

            if (originalByte == newByte) { // unchanged

                if (currentPatchStart !== -1) { // end our current patch!

                    allPatches.push({position: currentPatchStart, data: currentPatch});

                    currentPatchStart = -1;
                    currentPatch = []

                }
            } else { // changed

                if (currentPatchStart === -1) { // create a new patch
                    currentPatchStart = i;
                }

                currentPatch.push(newByte); // add to patch
            }
        }

        if (currentPatchStart !== -1) { // end our final patch!

            allPatches.push({position: currentPatchStart, data: currentPatch});
        }

        const patchedBytes = new MemorySpan(new ArrayBuffer(allPatches.map(patch => patch.data.length + 4).reduce((curr, prev) => curr + prev, 0)));

        allPatches.forEach(patch => {
            patchedBytes.writeUint16(patch.position); // byte num
            patchedBytes.writeUint16(patch.data.length); // patch length
            patch.data.forEach(byte => patchedBytes.writeUint8(byte));
        });

        return patchedBytes;
    }

    applyPatch(patch: MemorySpan) {
        if (patch.data.byteLength == 0) {
            return;
        }

        const dataAsArray = new Uint8Array(this.data);

        while (!patch.complete) {
            const patchPos = patch.readUint16();
            const patchLength = patch.readUint16();

            const patchData = new Uint8Array(patch.readArrayBufferSlice(patchLength));

            dataAsArray.set(patchData, patchPos);
        }
    }

    get blocksPerPage(): number {
        return Math.floor(this.pageSize / this.blockSize);
    }

    readString(source: number, length: number): string {
        const slice = new Int8Array(this.data, source, length);

        return Buffer.from(slice).toString("utf-8");
    }

    getBlock(blockIndex: number): MemorySpan {
        return this.getMemorySpan(this.flashStart + blockIndex * this.blockSize, this.blockSize);
    }

    getMemorySpan(source: number, length: number): MemorySpan {
        return new MemorySpan(new DataView(this.data, source, length));
    }

    erase(source: number, length: number) {
        const range = new Uint8Array(this.data);

        range.fill(BlockInfoFlag.Unused, source, source + length);
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

    getContainingBlockIndex(address: number): number {
        return Math.floor((address - this.flashStart) / this.blockSize);
    }

    recyclePage(blockIndex: number, type: BlockType = BlockType.File) {

        const page = this.getPageAddress(blockIndex);

        // Scratch holds our current state whilst in the middle of recycling
        const scratch = MemorySpan.empty(this.pageSize);

        let currentBlockIndex = this.getContainingBlockIndex(page);

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

                dir.entries.forEach(entry => {
                    // If the entry is not valid, we don't want to save it!
                    if (!(entry as MicroDirectoryEntry).hasFlags(DirectoryEntryFlag.Valid)) {
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
        }

        // Write our scratch to the page...
        this.getMemorySpan(page, this.pageSize).write(scratch);
    }
}

interface Patch {

    position: number,
    data: number[]
}