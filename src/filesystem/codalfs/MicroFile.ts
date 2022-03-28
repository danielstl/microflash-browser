import {File} from "@/filesystem/core/File";
import {DirectoryEntry} from "@/filesystem/core/DirectoryEntry";
import {MicroDirectoryEntry} from "@/filesystem/codalfs/MicroDirectoryEntry";
import {MicroflashFilesystem} from "@/filesystem/codalfs/MicroflashFilesystem";
import {MicroDirectory} from "@/filesystem/codalfs/MicroDirectory";
import {BlockInfoFlag} from "@/filesystem/codalfs/BlockInfoFlag";
import {DirectoryEntryFlag} from "@/filesystem/codalfs/DirectoryEntryFlag";

export class MicroFile extends File {

    constructor(data: ArrayBuffer | null, meta: DirectoryEntry, public blockInfo: number[]) {
        super(data, meta);
    }

    static readFromDirectoryEntry(filesystem: MicroflashFilesystem, file: MicroDirectoryEntry): File {

        // Directories (which extend File) have different parsing logic, so parse it differently here
        if ((file.flags & DirectoryEntryFlag.Directory) === DirectoryEntryFlag.Directory) {
            return MicroDirectory.readFromDirectoryEntry(filesystem, file);
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

        return new MicroFile(data.buffer, file, blockIndexes);
    }
}