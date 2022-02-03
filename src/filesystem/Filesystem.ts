import {FlashReadWriter} from "./FlashReadWriter";
import * as Constants from "./Constants";

export class Filesystem {

    flash: FlashReadWriter;
    fileSystemSize: number; // Number of logical pages available for file data (incl. file table)
    fileAllocationTable: FileAllocationTable;

    rootDirectory: Directory;

    constructor(data: ArrayBuffer) {
        this.flash = new FlashReadWriter(data); //todo
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

        return Directory.readFromDirectoryEntry(this, null, rootDir);
    }
}

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
}

export class DirectoryEntry {

    filesystem: Filesystem;
    parent: Directory | null;

    fileName: string; // 16 bytes
    firstBlock: number; // 2 bytes
    flags: number; // 2 bytes
    length: number; // 4 bytes

    constructor(filesystem: Filesystem, parent: Directory | null, fileName: string, firstBlock: number, flags: number, length: number) {
        this.filesystem = filesystem;
        this.parent = parent;

        this.fileName = fileName;
        this.firstBlock = firstBlock;
        this.flags = flags;
        this.length = length;
    }

    static readFromBlock(filesystem: Filesystem, parent: Directory | null, blockIndex: number, offset: number = 0): DirectoryEntry {
        const block = filesystem.flash.getBlock(blockIndex);

        block.skip(offset);

        return new DirectoryEntry(filesystem, parent, block.readString(16), block.readUint16(), block.readUint16(), block.readUint32());
    }

    get fullyQualifiedFileName() : string {
        let name = this.fileName;
        let parent = this.parent;
        
        while (parent != null) {
            name = parent?.meta.fileName + Constants.CODALFS_FILE_SEPARATOR + name;
            parent = parent.parent;
        }
        
        return name;
    }

    readData(): File {
        return File.readFromDirectoryEntry(this.filesystem, this.parent, this);
    }

    hasFlags(flags: number) : boolean {
        return (this.flags & flags) === flags;
    }

    isDirectory() : boolean {
        return this.hasFlags(DirectoryEntryFlag.Directory);
    }
}

export class File {

    parent: Directory | null;
    data: ArrayBuffer | null;
    meta: DirectoryEntry;

    constructor(parent: Directory | null, data: ArrayBuffer | null, meta: DirectoryEntry) {
        this.parent = parent;
        this.data = data;
        this.meta = meta;
    }

    static readFromDirectoryEntry(filesystem: Filesystem, parent: Directory | null, file: DirectoryEntry): File {

        // Directories (which extend File) have different parsing logic, so parse it differently here
        if ((file.flags & DirectoryEntryFlag.Directory) === DirectoryEntryFlag.Directory) {
            return Directory.readFromDirectoryEntry(filesystem, parent, file);
        }

        const splitData = new Array<Uint8Array>();

        let blockIndex = file.firstBlock;
        let remainingBytes = file.length;

        while (remainingBytes > 0) {
            const block = filesystem.flash.getBlock(blockIndex);

            const toRead = Math.min(filesystem.flash.blockSize, remainingBytes); // only read as much as we need
            splitData.push(new Uint8Array(block.data.buffer.slice(0, toRead)));

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

        return new File(parent, data.buffer, file);
    }
}

export class Directory extends File {

    entries: Array<DirectoryEntry>;

    constructor(parent: Directory | null, entries: Array<DirectoryEntry>, meta: DirectoryEntry) {
        super(parent, null, meta);
        this.entries = entries;

        this.entries.forEach(e => e.parent = this); //todo better way of doing this?
    }

    getAllFiles(): Array<File> {
        return this.entries.map(e => e.readData());
    }

    static readFromDirectoryEntry(filesystem: Filesystem, parent: Directory | null, directory: DirectoryEntry): Directory {

        const entries = new Array<DirectoryEntry>();

        let blockIndex = directory.firstBlock;

        let offset = 0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            // If reading the next directory would go over the block boundary, skip right ahead to the next block
            if (offset + Constants.SIZEOF_DIRECTORYENTRY > filesystem.flash.blockSize) {
                // This will tell us the *next* block for the current file - or an erroneous value such as EOF
                blockIndex = filesystem.fileAllocationTable.getBlockInfo(blockIndex);

                if (blockIndex === BlockInfoFlag.EndOfFile) {
                    break;
                }

                offset = 0;
            }

            const entry = DirectoryEntry.readFromBlock(filesystem, parent, blockIndex, offset);

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

                entries.push(entry);
            }
        }

        return new Directory(parent, entries, directory);
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

export enum DirectoryEntryFlag {

    Free = 0x8000,
    Valid = 0x4000,
    Directory = 0x2000,
    New = 0xffff,
    Deleted = 0x0000
}

export enum BlockType {

    File = 1,
    Directory = 2,
    FileTable = 3
}

export enum BlockInfoFlag {

    Unused = 0xffff,
    EndOfFile = 0xefff,
    Deleted = 0x0000
}