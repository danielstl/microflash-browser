import {MemorySpan} from "./MemorySpan";
import {
    BlockInfoFlag,
    BlockType,
    Directory,
    DirectoryEntry,
    DirectoryEntryFlag,
    Filesystem
} from "@/filesystem/Filesystem";

export class FlashReadWriter {

    filesystem: Filesystem;

    flashStart = 0;
    flashEnd = 0;
    pageSize = 1024;
    blockSize = 512;
    flashSize = 131072;

    data: ArrayBuffer;
    dataView: DataView;

    lastBlockAllocated = 0;

    constructor(filesystem: Filesystem, data: ArrayBuffer) {
        this.filesystem = filesystem;
        this.data = data;
        this.dataView = new DataView(this.data);
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
        const range = new Uint8Array(this.data, source, length);

        range.fill(BlockInfoFlag.Unused);
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

                const entry = DirectoryEntry.readFromBlock(this.filesystem, null, currentBlockIndex);
                const dir = Directory.readFromDirectoryEntry(this.filesystem, entry, true);

                dir.entries.forEach(entry => {
                    // If the entry is not valid, we don't want to save it!
                    if (!entry.hasFlags(DirectoryEntryFlag.Valid)) {
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