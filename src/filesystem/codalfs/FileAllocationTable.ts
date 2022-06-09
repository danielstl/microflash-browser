/**
 * The file allocation table is stored at the start of the filesystem, and
 * contains information about how each subsequent block in the filesystem
 * is being used.
 */
import {MicroflashFilesystem} from "@/filesystem/codalfs/MicroflashFilesystem";
import {BlockInfoFlag} from "@/filesystem/codalfs/BlockInfoFlag";

/**
 * The file allocation table is stored at the start of the filesystem, and
 * contains information about how each subsequent block in the filesystem
 * is being used.
 */
export class FileAllocationTable {

    fileTableSize: number;

    constructor(public filesystem: MicroflashFilesystem, fileSystemSize: number, blockSize: number) {
        this.filesystem = filesystem;

        this.fileTableSize = Math.floor((fileSystemSize * 2) / blockSize);

        if ((fileSystemSize * 2) % blockSize) {
            this.fileTableSize++;
        }
    }

    getBlockInfo(blockIndex: number): number {
        return this.filesystem.flash.dataView.getUint16(this.filesystem.flash.flashStart + blockIndex * 2, true); // Read out an integer
    }

    setBlockInfo(blockIndex: number, value: number) {
        this.filesystem.flash.dataView.setUint16(this.filesystem.flash.flashStart + blockIndex * 2, value, true);
    }

    recycle() { // Mark all DELETED blocks as UNUSED
        let pageRecycled = false;

        for (let block = 0; block < this.filesystem.fileSystemSize; block++) {

            // If we just crossed a page boundary, reset the page recycled flag
            if (block % (this.filesystem.flash.pageSize / this.filesystem.flash.blockSize) == 0) {
                pageRecycled = false;
            }

            if (this.getBlockInfo(block) == BlockInfoFlag.Deleted && !pageRecycled) {
                this.filesystem.flash.recyclePage(block);
                pageRecycled = true;
            }
        }

        // now, recycle the FileSystemTable itself, upcycling entries marked as DELETED to UNUSED as we go.
        for (let block = 0; block < this.fileTableSize; block += this.filesystem.flash.blocksPerPage) {
            this.filesystem.flash.recyclePage(block);
        }
    }

    /**
     * When extending a file requires a new block, this new block must be linked
     * to the old block. This method will recursively read through the blocks to
     * do this.
     *
     * Before:
     * [ firstBlock ] -> [ BLOCK 2 ] -> [ BLOCK 3 ] -> [ END OF FILE ]
     *
     * After:
     * [ firstBlock ] -> [ BLOCK 2 ] -> [ BLOCK 3 ] -> [ newBlock ] -> [ END OF FILE ]
     *
     * @param firstBlock the first block in the chain
     * @param newBlock the new block to link to the last current block in the chain
     */
    extendBlockChain(firstBlock: number, newBlock: number) {
        const pointedBlock = this.getBlockInfo(firstBlock);

        if (pointedBlock == BlockInfoFlag.EndOfFile) {
            // we're at the current last block, so append the new block info here

            this.setBlockInfo(pointedBlock, newBlock);
            this.setBlockInfo(newBlock, BlockInfoFlag.EndOfFile);
            return;
        }

        this.extendBlockChain(pointedBlock, newBlock);
    }
}