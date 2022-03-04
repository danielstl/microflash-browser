import {FlashReadWriter} from "./FlashReadWriter";
import * as Constants from "./Constants";
import {CODALFS_DIRECTORY_LENGTH, CODALFS_FILE_SEPARATOR, CODALFS_MAX_FILE_LENGTH} from "./Constants";
import {MemorySpan} from "@/filesystem/MemorySpan";

/**
 * The filesystem contains a reference to the raw flash data contained
 * within the micro:bit.
 */
export class Filesystem {

    flash: FlashReadWriter;
    fileSystemSize: number; // Number of logical pages available for file data (incl. file table)
    fileAllocationTable: FileAllocationTable;

    rootDirectory: Directory;

    constructor(data: ArrayBuffer) {
        this.flash = new FlashReadWriter(this, data); //todo
        this.fileSystemSize = this.flash.flashSize / this.flash.blockSize;
        this.fileAllocationTable = new FileAllocationTable(this, this.fileSystemSize, this.flash.blockSize);

        this.rootDirectory = this.load();

        // @ts-ignore
        window.$fs = this;
    }

    load(): Directory {
        const rootOffset = this.fileAllocationTable.getBlockInfo(0); // root block

        for (let i = 0; i < rootOffset; i++) {
            const blockStatus = this.fileAllocationTable.getBlockInfo(i);

            if (blockStatus != rootOffset) {
                throw new Error("File table is corrupted");
            }
        }

        const rootDir = DirectoryEntry.readFromBlock(this, null, rootOffset);

        console.log(rootDir);

        if (rootDir.fileName != Constants.CODALFS_MAGIC) {
            throw new Error("Root directory has invalid magic file name");
        }

        return Directory.readFromDirectoryEntry(this, rootDir);
    }

    static validateFilename(filename: string, allowNesting: boolean = true): boolean {
        const length = filename.length;

        // Name must be null terminated
        if (length == 0 || filename.charCodeAt(length - 1) != 0) {
            return false;
        }

        let currentDirectoryLength = 0;

        for (let i = 0; i < length - 1; i++) { // don't check last byte as we know it is null
            currentDirectoryLength++;

            if (filename.charCodeAt(i) < 32 || filename.charCodeAt(i) > 126) {
                return false;
            }

            if (filename.charAt(i) == CODALFS_FILE_SEPARATOR) {
                if (!allowNesting) {
                    return false;
                }

                if (currentDirectoryLength == 0) {
                    return false; // There shouldn't be duplicate separators (//)
                }

                currentDirectoryLength = 0;
            }

            if (currentDirectoryLength > CODALFS_MAX_FILE_LENGTH) {
                return false; // One component of this filename is too long
            }
        }

        return true;
    }
}

/**
 * The file allocation table is stored at the start of the filesystem, and
 * contains information about how each subsequent block in the filesystem
 * is being used.
 */
export class FileAllocationTable {

    filesystem: Filesystem;
    table: Array<number>; // BlockType
    fileTableSize: number;

    constructor(filesystem: Filesystem, fileSystemSize: number, blockSize: number) {
        this.filesystem = filesystem;

        this.fileTableSize = Math.floor((fileSystemSize * 2) / blockSize);

        if ((fileSystemSize * 2) % blockSize) {
            this.fileTableSize++;
        }

        this.table = []; //todo
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

/**
 * A directory entry contains metadata about a file or directory, pointing
 * to where the data for it is held to facilitate reading or writing.
 */
export class DirectoryEntry implements FlashWritable {

    filesystem: Filesystem;
    parent: Directory | null;

    containingBlock: number;
    containingBlockOffset: number;

    fileName: string; // 16 bytes
    firstBlock: number; // 2 bytes
    flags: number; // 2 bytes
    length: number; // 4 bytes

    constructor(filesystem: Filesystem, parent: Directory | null, containingBlock: number, containingBlockOffset: number, fileName: string, firstBlock: number, flags: number, length: number) {
        this.filesystem = filesystem;
        this.parent = parent;
        this.containingBlock = containingBlock;
        this.containingBlockOffset = containingBlockOffset;

        this.fileName = fileName;
        this.firstBlock = firstBlock;
        this.flags = flags;
        this.length = length;
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
    static readFromBlock(filesystem: Filesystem, parent: Directory | null, blockIndex: number, offset: number = 0): DirectoryEntry {
        const block = filesystem.flash.getBlock(blockIndex);

        console.log("block!", block);

        block.skip(offset);

        return new DirectoryEntry(filesystem, parent, blockIndex, offset, block.readString(16), block.readUint16(), block.readUint16(), block.readUint32());
    }

    /**
     * Returns the filename obtained by concatenating this filename with all of its parents' filenames
     */
    get fullyQualifiedFileName(): string {
        let name = this.fileName;
        let parent = this.parent;

        while (parent != null) {
            name = parent?.meta.fileName + Constants.CODALFS_FILE_SEPARATOR + name;
            parent = parent.parent;
        }

        return name;
    }

    /**
     * Returns directory entries for each successive parent of this entry, followed by
     * this entry itself
     *
     * /nested/file/here/ -> [/nested/, /file/, /here/]
     *
     * @returns the directory hierarchy for this entry
     */
    get breadcrumbs(): Array<DirectoryEntry> {
        const breadcrumbs = new Array<DirectoryEntry>();

        breadcrumbs.push(this);
        let parent = this.parent;

        while (parent != null) {
            breadcrumbs.splice(0, 0, parent.meta);
            parent = parent.parent;
        }

        return breadcrumbs;
    }

    /**
     * Reads the file referenced by this directory entry
     * @returns this entry's file
     */
    readData(): File {
        return File.readFromDirectoryEntry(this.filesystem, this);
    }

    writeData(toWrite: MemorySpan | string) {
        if (typeof toWrite == "string") {
            toWrite = new MemorySpan(new TextEncoder().encode(toWrite + "\0").buffer);
        }

        const length = toWrite.data.byteLength;
        let written = 0;

        let block = this.firstBlock;
        let prevBlock = this.firstBlock;

        alert(block);

        while (written < length) {
            // extend the chain, otherwise use the existing chain...
            if (block == BlockInfoFlag.EndOfFile) {
                block = this.filesystem.flash.getFreeBlockIndex();
                this.filesystem.fileAllocationTable.setBlockInfo(prevBlock, block);
            }

            const writeToBlock = toWrite.readArrayBufferSlice(Math.min(this.filesystem.flash.blockSize, length - written));

            this.filesystem.flash.getBlock(block).write(new MemorySpan(writeToBlock));

            written += writeToBlock.byteLength;

            prevBlock = block;
            block = this.filesystem.fileAllocationTable.getBlockInfo(block);
        }

        // mark any old blocks as empty
        // TODO check if this is appropriate?
        while (block != BlockInfoFlag.EndOfFile) {
            const newBlock = this.filesystem.fileAllocationTable.getBlockInfo(block);

            if (newBlock == BlockInfoFlag.EndOfFile) {
                return;
            }

            this.filesystem.fileAllocationTable.setBlockInfo(newBlock, BlockInfoFlag.EndOfFile);
        }

        this.length = written;

        this.writeToFlash(this.filesystem.flash.getBlock(this.containingBlock).atOffset(this.containingBlockOffset)); // write back the length
    }

    /**
     * Utility method for checking specific metadata about this entry
     *
     * @param flags the flag(s) to check
     * @returns true if the flag(s) are present
     */
    hasFlags(flags: DirectoryEntryFlag): boolean {
        return (this.flags & flags) === flags;
    }

    /**
     * Utility method for querying for the DirectoryEntryFlag.Directory flag
     *
     * @returns true if this is a directory
     */
    isDirectory(): boolean {
        return this.hasFlags(DirectoryEntryFlag.Directory);
    }

    isValid(): boolean {
        return this.hasFlags(DirectoryEntryFlag.Valid) && !this.hasFlags(DirectoryEntryFlag.New);
    }

    delete(): FileDeleteResult {
        if (this.parent == null) {
            return FileDeleteResult.ROOT_CANNOT_BE_DELETED;
        }

        return this.parent.deleteFile(this);
    }
}

/**
 * Represents a file stored within the CodalFS. This is constructed from a DirectoryEntry,
 * which contains appropriate information about which blocks to read the data from, along
 * with the file length, name, and parent.
 */
export class File {

    parent: Directory | null;
    data: ArrayBuffer | null;
    meta: DirectoryEntry;
    blockInfo: Array<number>; // a list of all blocks which contain data for this file

    constructor(parent: Directory | null, data: ArrayBuffer | null, blockInfo: Array<number>, meta: DirectoryEntry) {
        this.parent = parent;
        this.data = data;
        this.blockInfo = blockInfo;
        this.meta = meta;
    }

    static readFromDirectoryEntry(filesystem: Filesystem, file: DirectoryEntry): File {

        // Directories (which extend File) have different parsing logic, so parse it differently here
        if ((file.flags & DirectoryEntryFlag.Directory) === DirectoryEntryFlag.Directory) {
            return Directory.readFromDirectoryEntry(filesystem, file);
        }

        const splitData = new Array<Uint8Array>();
        const blockIndexes = new Array<number>();

        let blockIndex = file.firstBlock;
        let remainingBytes = file.length;

        while (remainingBytes > 0) {
            const block = filesystem.flash.getBlock(blockIndex);
            blockIndexes.push(blockIndex);

            const toRead = Math.min(filesystem.flash.blockSize, remainingBytes); // only read as much as we need
            splitData.push(new Uint8Array(block.readArrayBufferSlice(toRead)));

            remainingBytes -= toRead;

            if (remainingBytes <= 0) {
                break;
            }

            // This will tell us the *next* block for the current file - or an erroneous value such as EOF
            blockIndex = filesystem.fileAllocationTable.getBlockInfo(blockIndex);

            if (blockIndex === BlockInfoFlag.EndOfFile) {
                break;
            }
        }

        const data = new Uint8Array(file.length);
        let splitIndex = 0;

        splitData.forEach(block => {
            data.set(block, splitIndex);
            splitIndex += block.byteLength;
        });

        return new File(file.parent, data.buffer, blockIndexes, file);
    }
}

/**
 * Represents a directory within the CodalFS. As, internally, directories are specialised
 * files, this inherits all functionality from the base File class.
 *
 * The contents within this file, being a list of directory entries, is parsed automatically
 * into 'entries'
 */
export class Directory extends File {

    entries: Array<DirectoryEntry>;

    constructor(parent: Directory | null, entries: Array<DirectoryEntry>, blockInfo: Array<number>, meta: DirectoryEntry) {
        super(parent, null, blockInfo, meta);
        this.entries = entries;

        this.entries.forEach(e => e.parent = this); //todo better way of doing this?
    }

    get validEntries() {
        return this.entries.filter(e => e.isValid());
    }

    getAllFiles(validOnly: boolean = false): Array<File> {
        return this.entries.filter(e => !validOnly || e.isValid()).map(e => e.readData());
    }

    getRelativeEntry(filename: string): DirectoryEntry | null {
        return this.entries.find(entry => entry.isValid() && entry.fileName.toLowerCase() === filename.toLowerCase()) ?? null;
    }

    getAbsoluteFile(filename: string): File | null {
        const components = filename.split(CODALFS_FILE_SEPARATOR).filter(elem => elem != "");
        let currentFile: File = this;

        for (const elem of components) {
            const entry = (currentFile as Directory).getRelativeEntry(elem);

            if (!entry || !entry.isDirectory()) {
                return null; // one of the components doesn't exist or is not a directory...
            }

            currentFile = entry.readData();
        }

        return currentFile;
    }

    createFile(filename: string, directory: boolean): File | FileCreateError {

        if (!Filesystem.validateFilename(filename, false)) {
            return FileCreateError.INVALID_FILENAME;
        }

        if (this.getRelativeEntry(filename)) {
            return FileCreateError.FILE_ALREADY_EXISTS;
        }

        const res = this.createDirectoryEntry();

        if (!(res instanceof DirectoryEntry)) {
            return res as FileCreateError;
        }

        const entry = res as DirectoryEntry;

        const newBlock = this.meta.filesystem.flash.getFreeBlockIndex();

        if (newBlock == 0) {
            return FileCreateError.NO_RESOURCES;
        }

        entry.firstBlock = newBlock;
        entry.fileName = filename;

        if (directory) {
            entry.flags = DirectoryEntryFlag.Valid | DirectoryEntryFlag.Directory;
            entry.length = CODALFS_DIRECTORY_LENGTH;
        } else {
            entry.flags = DirectoryEntryFlag.New;
            entry.length = 0xFFFFFFFF; // we'll set the actual length when the file is written...
        }

        // write to the flash!
        const flash = this.meta.filesystem.flash.getBlock(entry.containingBlock);
        flash.skip(entry.containingBlockOffset);

        entry.writeToFlash(flash);
        this.meta.filesystem.fileAllocationTable.setBlockInfo(newBlock, BlockInfoFlag.EndOfFile);

        return entry.readData();
    }

    private writeNewFile(filename: string): File | FileCreateError {
        if (!Filesystem.validateFilename(filename, false)) {
            return FileCreateError.INVALID_FILENAME;
        }

        if (this.getRelativeEntry(filename)) {
            return FileCreateError.FILE_ALREADY_EXISTS;
        }

        return FileCreateError.FILE_ALREADY_EXISTS;
    }

    private createDirectoryEntry(): DirectoryEntry | FileCreateError {
        // we want to find an available slot. Either empty, or invalid. We keep track of which slot we've found
        // along with the type of slot it is here - as the logic for each type is slightly different

        let entryToModify: DirectoryEntry | null = null;
        let entryIsInvalid = false;

        for (const entry of this.entries) { // read through all existing entries first to try to find an appropriate slot

            // ideally we just want to modify an existing empty entry
            if (entry.hasFlags(DirectoryEntryFlag.Free)) {
                entryToModify = entry;
                break; // we don't need to keep looking
            }

            // we can also look for invalid entries, which we'll use if we can't find an empty one
            if (!entry.hasFlags(DirectoryEntryFlag.Valid)) {
                entryToModify = entry;
                entryIsInvalid = true;
            }
        }

        // if we couldn't find one, we need to make a new one by allocating a new block...
        if (entryToModify == null) {

            const newBlock = this.meta.filesystem.flash.getFreeBlockIndex();

            if (newBlock == 0) { // no spare blocks!
                return FileCreateError.NO_RESOURCES;
            }

            this.meta.filesystem.fileAllocationTable.extendBlockChain(this.meta.firstBlock, newBlock);

            // todo how to handle first block here???
            return new DirectoryEntry(this.meta.filesystem, this, newBlock, 0, "NEW_FILE", -1, DirectoryEntryFlag.Free, 0);
        }

        if (entryIsInvalid) {
            this.meta.filesystem.flash.recyclePage(entryToModify.containingBlock, BlockType.Directory);
        }

        entryToModify.fileName = "NEW_FILE";
        entryToModify.firstBlock = -1; // todo
        entryToModify.flags = DirectoryEntryFlag.Free;
        entryToModify.length = 0;

        return entryToModify;
    }

    deleteFile(filename: string | DirectoryEntry): FileDeleteResult {
        const entry = typeof filename == "string" ? this.getRelativeEntry(filename) : filename;

        if (entry == null) {
            return FileDeleteResult.INVALID_FILENAME;
        }

        let block = entry.firstBlock;
        let nextBlock: number;

        while (block != BlockInfoFlag.EndOfFile) {
            nextBlock = entry.filesystem.fileAllocationTable.getBlockInfo(block);
            entry.filesystem.fileAllocationTable.setBlockInfo(block, BlockInfoFlag.Deleted);
            block = nextBlock;
        }

        entry.flags = DirectoryEntryFlag.Deleted;

        const flash = entry.filesystem.flash.getBlock(entry.containingBlock);
        flash.skip(entry.containingBlockOffset);
        entry.writeToFlash(flash);

        return FileDeleteResult.SUCCESS;
    }

    static readFromDirectoryEntry(filesystem: Filesystem, directory: DirectoryEntry, singleBlock: boolean = false): Directory {

        const entries = new Array<DirectoryEntry>();

        let blockIndex = directory.firstBlock;
        const blockIndexes = new Array<number>();

        blockIndexes.push(blockIndex);

        let offset = 0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            // If reading the next directory would go over the block boundary, skip right ahead to the next block
            if (offset + Constants.SIZEOF_DIRECTORYENTRY > filesystem.flash.blockSize) {

                // If we only want to read the first block, stop here, returning only the partial contents
                if (singleBlock) {
                    break;
                }

                // This will tell us the *next* block for the current file - or an erroneous value such as EOF
                blockIndex = filesystem.fileAllocationTable.getBlockInfo(blockIndex);

                if (blockIndex === BlockInfoFlag.EndOfFile) {
                    break;
                }

                offset = 0;
                blockIndexes.push(blockIndex);
            }

            const entry = DirectoryEntry.readFromBlock(filesystem, directory.parent, blockIndex, offset);

            offset += Constants.SIZEOF_DIRECTORYENTRY;

            if (entry.firstBlock == directory.firstBlock) {
                continue; // We've found ourselves, we can ignore this...
            }

            // Check validity of this entry...
            if ((entry.flags & DirectoryEntryFlag.Free) !== DirectoryEntryFlag.Free && (entry.flags & DirectoryEntryFlag.Valid) === DirectoryEntryFlag.Valid) {

                // We're a directory!
                if ((entry.flags & DirectoryEntryFlag.Directory) === DirectoryEntryFlag.Directory) {
                    console.log(entry, " directory, first block: " + entry.firstBlock);
                    // this.readFromDirectoryEntry(filesystem, entry); TODO, recurse here?
                } else {
                    console.log(entry);
                }
            }

            entries.push(entry);
        }

        return new Directory(directory.parent, entries, blockIndexes, directory);
    }
}

export interface FileDescriptor {

    flags: number;
    id: number;
    seek: number;
    length: number;
    address: number;
    directory: DirectoryEntry;
    next: FileDescriptor; //todo
}

/**
 * Flags used to represent the state of directory entries
 */
export enum DirectoryEntryFlag {

    Free = 0x8000,
    Valid = 0x4000,
    Directory = 0x2000,
    New = 0xffff,
    Deleted = 0x0000
}

/**
 * Special states for representing the different types of blocks within
 * the filesystem for API use
 */
export enum BlockType {

    File = 1,
    Directory = 2,
    FileTable = 3
}

/**
 * Represents special states for entries within the file allocation table.
 * Normally, the value for each block's allocation table entry is the next
 * block number to facilitate reading files. However, each entry may also
 * be one of these values
 */
export enum BlockInfoFlag {

    Unused = 0xffff,
    EndOfFile = 0xefff,
    Deleted = 0x0000
}

/**
 * Allows classes which implement this to support writing their state to
 * the filesystem in raw bytes
 */
export interface FlashWritable {

    writeToFlash(flash: MemorySpan): void;
}

export enum FileCreateError {

    FILE_ALREADY_EXISTS,
    INVALID_FILENAME,
    NO_RESOURCES
}

export enum FileDeleteResult {

    SUCCESS,
    INVALID_FILENAME,
    ROOT_CANNOT_BE_DELETED
}