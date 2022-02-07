import {FlashReadWriter} from "./FlashReadWriter";
import * as Constants from "./Constants";
import {MemorySpan} from "@/filesystem/MemorySpan";

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
}

export class DirectoryEntry implements FlashWritable {

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

    writeToFlash(flash: MemorySpan): void {
        flash.writeString(this.fileName, 16);
        flash.writeUint16(this.firstBlock);
        flash.writeUint16(this.flags);
        flash.writeUint32(this.length);
    }

    static readFromBlock(filesystem: Filesystem, parent: Directory | null, blockIndex: number, offset: number = 0): DirectoryEntry {
        const block = filesystem.flash.getBlock(blockIndex);

        console.log("block!", block);

        block.skip(offset);

        return new DirectoryEntry(filesystem, parent, block.readString(16), block.readUint16(), block.readUint16(), block.readUint32());
    }

    get fullyQualifiedFileName(): string {
        let name = this.fileName;
        let parent = this.parent;

        while (parent != null) {
            name = parent?.meta.fileName + Constants.CODALFS_FILE_SEPARATOR + name;
            parent = parent.parent;
        }

        return name;
    }

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

    readData(): File {
        return File.readFromDirectoryEntry(this.filesystem, this);
    }

    hasFlags(flags: DirectoryEntryFlag): boolean {
        return (this.flags & flags) === flags;
    }

    isDirectory(): boolean {
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

    static readFromDirectoryEntry(filesystem: Filesystem, file: DirectoryEntry): File {

        // Directories (which extend File) have different parsing logic, so parse it differently here
        if ((file.flags & DirectoryEntryFlag.Directory) === DirectoryEntryFlag.Directory) {
            return Directory.readFromDirectoryEntry(filesystem, file);
        }

        const splitData = new Array<Uint8Array>();

        let blockIndex = file.firstBlock;
        let remainingBytes = file.length;

        while (remainingBytes > 0) {
            const block = filesystem.flash.getBlock(blockIndex);

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

        return new File(file.parent, data.buffer, file);
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

    static readFromDirectoryEntry(filesystem: Filesystem, directory: DirectoryEntry, singleBlock: boolean = false): Directory {

        const entries = new Array<DirectoryEntry>();

        let blockIndex = directory.firstBlock;

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

                entries.push(entry);
            }
        }

        return new Directory(directory.parent, entries, directory);
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

export interface FlashWritable {

    writeToFlash(flash: MemorySpan): void;
}