import {Filesystem} from "@/filesystem/core/Filesystem";
import {FlashManager} from "@/filesystem/codalfs/FlashManager";
import {FileAllocationTable} from "@/filesystem/codalfs/FileAllocationTable";
import {MicroDirectory} from "@/filesystem/codalfs/MicroDirectory";
import * as Constants from "@/filesystem/utils/Constants";
import {MicroDirectoryEntry} from "@/filesystem/codalfs/MicroDirectoryEntry";
import {CODALFS_FILE_SEPARATOR, CODALFS_MAX_FILE_LENGTH} from "@/filesystem/utils/Constants";

export class MicroflashFilesystem extends Filesystem {

    flash: FlashManager;
    fileSystemSize: number; // Number of logical pages available for file data (incl. file table)
    fileAllocationTable: FileAllocationTable;

    rootDirectory: MicroDirectory;

    constructor(data: ArrayBuffer) {
        super();

        this.flash = new FlashManager(this, data); //todo
        this.fileSystemSize = this.flash.flashSize / this.flash.blockSize;
        this.fileAllocationTable = new FileAllocationTable(this, this.fileSystemSize, this.flash.blockSize);

        this.rootDirectory = this.load();

        // @ts-ignore
        window.$fs = this;
    }

    load(): MicroDirectory {
        const rootOffset = this.fileAllocationTable.getBlockInfo(0); // root block

        for (let i = 0; i < rootOffset; i++) {
            const blockStatus = this.fileAllocationTable.getBlockInfo(i);

            if (blockStatus != rootOffset) {
                throw new Error("File table is corrupted");
            }
        }

        const rootDir = MicroDirectoryEntry.readFromBlock(this, null, rootOffset);

        console.log(rootDir);

        if (rootDir.fileName != Constants.CODALFS_MAGIC) {
            throw new Error("Root directory has invalid magic file name");
        }

        return MicroDirectory.readFromDirectoryEntry(this, rootDir);
    }

    public static validateFilename(filename: string, allowNesting: boolean = true): boolean {
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