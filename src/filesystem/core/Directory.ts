import {File} from "@/filesystem/core/File";
import {DirectoryEntry} from "@/filesystem/core/DirectoryEntry";
import {CODALFS_FILE_SEPARATOR} from "@/filesystem/Constants";
import {FileCreateError, FileDeleteResult} from "@/filesystem/Filesystem";

export abstract class Directory extends File {

    constructor(data: ArrayBuffer, meta: DirectoryEntry, public entries: DirectoryEntry[]) {
        super(null, meta);
    }

    get validEntries() {
        return this.entries.filter(e => e.isValid);
    }

    getAllFiles(validOnly = false) {
        return this.entries.filter(e => !validOnly || e.isValid).map(e => e.readData());
    }

    getRelativeEntry(filename: string): DirectoryEntry | null {
        return this.entries.find(entry => entry.isValid && entry.fileName.toLowerCase() === filename.toLowerCase()) ?? null;
    }

    getAbsoluteFile(filename: string): File | null {
        const components = filename.split(CODALFS_FILE_SEPARATOR).filter(elem => elem != "");
        let currentFile: File = this;

        for (const elem of components) {
            if (!currentFile.meta.isDirectory) {
                return null; // we can't read into a non-directory!
            }

            const entry = (currentFile as Directory).getRelativeEntry(elem);

            if (!entry) {
                return null; // one of the components doesn't exist...
            }

            currentFile = entry.readData();
        }

        return currentFile;
    }

    abstract createFile(filename: string, directory: boolean): File | FileCreateError; // todo throw instead?

    abstract deleteEntry(filename: string | DirectoryEntry): FileDeleteResult;
}