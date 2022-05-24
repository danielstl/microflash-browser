import {Directory} from "@/filesystem/core/File";
import {File} from "@/filesystem/core/File";
import {DirectoryEntry} from "@/filesystem/core/DirectoryEntry";
import * as Constants from "@/filesystem/utils/Constants";
import {MicroflashFilesystem} from "@/filesystem/codalfs/MicroflashFilesystem";
import {MicroDirectoryEntry} from "@/filesystem/codalfs/MicroDirectoryEntry";
import {FileCreateError} from "@/filesystem/core/FileCreateError";
import {FileDeleteResult} from "@/filesystem/core/FileDeleteResult";
import {BlockInfoFlag} from "@/filesystem/codalfs/BlockInfoFlag";
import {DirectoryEntryFlag} from "@/filesystem/codalfs/DirectoryEntryFlag";
import {CODALFS_DIRECTORY_LENGTH} from "@/filesystem/utils/Constants";
import {BlockType} from "@/filesystem/codalfs/BlockType";

export class MicroDirectory extends Directory {

    constructor(meta: DirectoryEntry, entries: DirectoryEntry[], public blockIndexes: number[]) {
        super(meta, entries);
    }

    createFile(filename: string, directory: boolean): File | FileCreateError {
        if (!MicroflashFilesystem.validateFilename(filename, false)) {
            return FileCreateError.INVALID_FILENAME;
        }

        if (this.getRelativeEntry(filename)) {
            return FileCreateError.FILE_ALREADY_EXISTS;
        }

        const res = this.createDirectoryEntry();

        if (!(res instanceof MicroDirectoryEntry)) {
            return res as FileCreateError;
        }

        const fs = (this.meta as MicroDirectoryEntry).filesystem;

        const entry = res as MicroDirectoryEntry;

        const newBlock = fs.flash.getFreeBlockIndex();

        if (newBlock == 0) {
            return FileCreateError.NO_RESOURCES;
        }

        entry.firstBlock = newBlock;
        entry.fileName = filename;

        if (directory) {
            entry.flags = DirectoryEntryFlag.Valid | DirectoryEntryFlag.Directory;
            entry.length = CODALFS_DIRECTORY_LENGTH;
        } else {
            entry.flags = DirectoryEntryFlag.Valid; //todo new??
            entry.length = 0; // we'll set the actual length when the file is written...
            //entry.length = 0xFFFFFFFF; // we'll set the actual length when the file is written...
        }

        // write to the flash!
        const flash = fs.flash.getBlock(entry.containingBlock);
        flash.skip(entry.containingBlockOffset);

        entry.writeToFlash(flash);
        fs.fileAllocationTable.setBlockInfo(newBlock, BlockInfoFlag.EndOfFile);

        return entry.readData();
    }

    private writeNewFile(filename: string): File | FileCreateError {
        if (!MicroflashFilesystem.validateFilename(filename, false)) {
            return FileCreateError.INVALID_FILENAME;
        }

        if (this.getRelativeEntry(filename)) {
            return FileCreateError.FILE_ALREADY_EXISTS;
        }

        return FileCreateError.FILE_ALREADY_EXISTS;
    }

    private createDirectoryEntry(): MicroDirectoryEntry | FileCreateError {
        // we want to find an available slot. Either empty, or invalid. We keep track of which slot we've found
        // along with the type of slot it is here - as the logic for each type is slightly different

        let entryToModify: MicroDirectoryEntry | null = null;
        let entryIsInvalid = false;

        for (const entry of this.entries) { // read through all existing entries first to try to find an appropriate slot
            if (!(entry instanceof MicroDirectoryEntry)) {
                continue; // get typescript to stop complaining :)
            }

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

        const fs = (this.meta as MicroDirectoryEntry).filesystem;

        // if we couldn't find one, we need to make a new one by allocating a new block...
        if (entryToModify == null) {
            const newBlock = fs.flash.getFreeBlockIndex();

            if (newBlock == 0) { // no spare blocks!
                return FileCreateError.NO_RESOURCES;
            }

            fs.fileAllocationTable.extendBlockChain((this.meta as MicroDirectoryEntry).firstBlock, newBlock);

            // todo how to handle first block here???
            return new MicroDirectoryEntry(fs, this, "NEW_FILE", DirectoryEntryFlag.Free, 0, newBlock, 0, -1);
        }

        if (entryIsInvalid) {
            fs.flash.recyclePage(entryToModify.containingBlock, BlockType.Directory);
        }

        entryToModify.fileName = "NEW_FILE";
        entryToModify.firstBlock = -1; // todo
        entryToModify.flags = DirectoryEntryFlag.Free;
        entryToModify.length = 0;

        return entryToModify;
    }

    modifyEntry(file: DirectoryEntry, contents: string) {
        if (!(file instanceof MicroDirectoryEntry)) {
            return;
        }

        file.writeData(contents);
    }

    deleteEntry(filename: string | DirectoryEntry): FileDeleteResult {
        const entry = (typeof filename == "string" ? this.getRelativeEntry(filename) : filename) as MicroDirectoryEntry;

        if (entry == null) {
            return FileDeleteResult.INVALID_FILENAME;
        }


        const file = entry.readData();

        if (file instanceof Directory) { // we're deleting a directory, make sure to recurse and delete all child entries...
            file.entries.forEach(entry => file.deleteEntry(entry));
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

    static readFromDirectoryEntry(filesystem: MicroflashFilesystem, directory: MicroDirectoryEntry, singleBlock: boolean = false): MicroDirectory {

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

            const entry = MicroDirectoryEntry.readFromBlock(filesystem, directory.parent, blockIndex, offset);

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

        return new MicroDirectory(directory, entries, blockIndexes);
    }

}