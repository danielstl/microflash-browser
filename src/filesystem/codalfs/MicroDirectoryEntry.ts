import {DirectoryEntry} from "@/filesystem/core/DirectoryEntry";
import {Directory} from "@/filesystem/core/File";
import {MemorySpan} from "@/filesystem/utils/MemorySpan";
import {MicroflashFilesystem} from "@/filesystem/codalfs/MicroflashFilesystem";
import {MicroFile} from "@/filesystem/codalfs/MicroFile";
import {File} from "@/filesystem/core/File";
import {FileDeleteResult} from "@/filesystem/core/FileDeleteResult";
import {BlockInfoFlag} from "@/filesystem/codalfs/BlockInfoFlag";
import {DirectoryEntryFlag} from "@/filesystem/codalfs/DirectoryEntryFlag";

export class MicroDirectoryEntry extends DirectoryEntry {

    /*
    Raw structure:
        fileName: 16 bytes
        firstBlock: 2 bytes
        flags: 2 bytes
        length: 4 bytes
     */

    constructor(public filesystem: MicroflashFilesystem, parent: Directory | null, fileName: string, public flags: DirectoryEntryFlag, length: number, public containingBlock: number, public containingBlockOffset: number, public firstBlock: number) {
        super(parent, fileName, length);
    }

    delete(): FileDeleteResult {
        if (this.parent == null) {
            return FileDeleteResult.ROOT_CANNOT_BE_DELETED;
        }

        return this.parent.deleteEntry(this);
    }

    hasFlags(flags: DirectoryEntryFlag): boolean {
        return (this.flags & flags) === flags;
    }

    get isDirectory(): boolean {
        return this.hasFlags(DirectoryEntryFlag.Directory);
    }

    get isValid(): boolean {
        return this.hasFlags(DirectoryEntryFlag.Valid) && !this.hasFlags(DirectoryEntryFlag.New);
    }

    readData(): File {
        return MicroFile.readFromDirectoryEntry(this.filesystem, this);
    }

    writeData(toWrite: MemorySpan | string): void {
        if (typeof toWrite == "string") {
            toWrite = new MemorySpan(new TextEncoder().encode(toWrite).buffer);
        }

        const length = toWrite.data.byteLength;
        let written = 0;

        let block = this.firstBlock;
        let prevBlock = this.firstBlock;

        while (written < length) {
            // extend the chain, otherwise use the existing chain...
            if (block == BlockInfoFlag.EndOfFile || block == BlockInfoFlag.Unused) {
                block = this.filesystem.flash.getFreeBlockIndex();
                this.filesystem.fileAllocationTable.setBlockInfo(prevBlock, block);
            }

            const writeToBlock = toWrite.readArrayBufferSlice(Math.min(this.filesystem.flash.blockSize, length - written));

            this.filesystem.flash.getBlock(block).write(new MemorySpan(writeToBlock));

            written += writeToBlock.byteLength;

            prevBlock = block;
            block = this.filesystem.fileAllocationTable.getBlockInfo(block);
        }

        const endBlock = prevBlock;

        // eslint-disable-next-line no-debugger
        debugger;

        // mark any old blocks as empty
        // TODO check if this is appropriate?
        while (block != BlockInfoFlag.EndOfFile && block != BlockInfoFlag.Unused) {
            const newBlock = this.filesystem.fileAllocationTable.getBlockInfo(block);

            this.filesystem.fileAllocationTable.setBlockInfo(block, BlockInfoFlag.Unused);

            if (newBlock == BlockInfoFlag.EndOfFile || newBlock == BlockInfoFlag.Unused) {
                break;
            }

            block = newBlock;
        }

        this.filesystem.fileAllocationTable.setBlockInfo(endBlock, BlockInfoFlag.EndOfFile);

        this.length = written;

        this.writeToFlash(this.filesystem.flash.getBlock(this.containingBlock).atOffset(this.containingBlockOffset)); // write back the length
    }

    writeToFlash(flash: MemorySpan): void {
        flash.writeString(this.fileName, 16);
        flash.writeUint16(this.firstBlock);
        flash.writeUint16(this.flags);
        flash.writeUint32(this.length);
    }

    /**
     * Reads a directory entry from a specific block and offset in storage.
     *
     * @param filesystem the filesystem to read from
     * @param parent the parent of this file
     * @param blockIndex the block to read from
     * @param offset the offset within the block to read from
     * @returns the parsed directory entry
     */
    static readFromBlock(filesystem: MicroflashFilesystem, parent: Directory | null, blockIndex: number, offset: number = 0): MicroDirectoryEntry {
        const block = filesystem.flash.getBlock(blockIndex);

        block.skip(offset);

        const fileName = block.readString(16);
        const firstBlock = block.readUint16();
        const flags = block.readUint16();
        const length = block.readUint16();

        return new MicroDirectoryEntry(filesystem, parent, fileName, flags, length, blockIndex, offset, firstBlock);
    }
}