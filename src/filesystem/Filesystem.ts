import {FlashReadWriter} from "./FlashReadWriter";
import * as Constants from "./Constants";
import * as Buffer from "buffer";

export class Filesystem {

    flash: FlashReadWriter;
    fileSystemSize: number; // Number of logical pages available for file data (incl. file table)
    fileAllocationTable: FileAllocationTable;

    rootDirectory: Directory;

    constructor(data: ArrayBuffer) {
        this.flash = new FlashReadWriter(data); //todo
        this.fileSystemSize = this.flash.flashSize / this.flash.blockSize;
        this.fileAllocationTable = new FileAllocationTable(this, this.fileSystemSize, this.flash.blockSize);

        this.load();

        // @ts-ignore
        window.$fs = this;
    }

    load() {
        const rootOffset = this.fileAllocationTable.getBlockInfo(0); // root block

        for (let i = 0; i < rootOffset; i++) {
            const blockStatus = this.fileAllocationTable.getBlockInfo(i);

            if (blockStatus != rootOffset) {
                console.error("LOAD ABORTED, FILE TABLE CORRUPTED"); // todo throw
                return;
            }
        }

        const rootDir = DirectoryEntry.readFromBlock(this, rootOffset);

        console.log(rootDir);

        if (rootDir.fileName != Constants.CODALFS_MAGIC) {
            console.error("Invalid magic!!!");
        }

        this.rootDirectory = Directory.readFromDirectoryEntry(this, rootDir);
    }

    getAllFiles() : Array<File | Directory> {

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

    getBlockInfo(blockIndex: number) : number {
        return this.filesystem.flash.dataView.getUint16(this.filesystem.flash.flashStart + blockIndex * 2, true); // Read out an integer
    }
}

export class DirectoryEntry {

    fileName: String; // 16 bytes
    firstBlock: number; // 2 bytes
    flags: number; // 2 bytes
    length: number; // 4 bytes

    constructor(fileName: String, firstBlock: number, flags: number, length: number) {
        this.fileName = fileName;
        this.firstBlock = firstBlock;
        this.flags = flags;
        this.length = length;
    }

    static readFromBlock(filesystem: Filesystem, blockIndex: number, offset: number = 0) : DirectoryEntry {
        const block = filesystem.flash.getBlock(blockIndex);

        block.skip(offset);

        return new DirectoryEntry(block.readString(16), block.readUint16(), block.readUint16(), block.readUint32());
    }
}

export class Directory extends File {

    entries: Array<DirectoryEntry>;

    constructor(data: ArrayBuffer, meta: DirectoryEntry) {
        super(data, meta);
        this.entries = entries;
    }

//constructor(entries: Array<DirectoryEntry>) {
    //    this.entries = entries;
    //}

    static readFromDirectoryEntry(filesystem: Filesystem, directory: DirectoryEntry) : Directory {

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

            const entry = DirectoryEntry.readFromBlock(filesystem, blockIndex, offset);

            offset += Constants.SIZEOF_DIRECTORYENTRY;

            if (entry.firstBlock == directory.firstBlock) {
                continue; // We've found ourselves, we can ignore this...
            }

            // Check validity of this entry...
            if ((entry.flags & DirectoryEntryFlag.Free) !== DirectoryEntryFlag.Free && (entry.flags & DirectoryEntryFlag.Valid) === DirectoryEntryFlag.Valid) {

                // We're a directory! Recursively scan for now...
                if ((entry.flags & DirectoryEntryFlag.Directory) === DirectoryEntryFlag.Directory) {
                    console.log(entry, " directory, first block: " + entry.firstBlock);
                    this.readFromDirectoryEntry(filesystem, entry);
                } else {
                    console.log(entry);
                }

                entries.push(entry);
            }
        }

        return new Directory(entries);
    }
}

export class File {

    data: ArrayBuffer;
    meta: DirectoryEntry;

    constructor(data: ArrayBuffer, meta: DirectoryEntry) {
        this.data = data;
        this.meta = meta;
    }

    static readFromDirectoryEntry(filesystem: Filesystem, file: DirectoryEntry) {

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

        return new File(data, file);
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