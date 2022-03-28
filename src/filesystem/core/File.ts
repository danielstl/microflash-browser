import {DirectoryEntry} from "@/filesystem/core/DirectoryEntry";
import JSZip from "jszip";
import {CODALFS_FILE_SEPARATOR} from "@/filesystem/utils/Constants";
import {FileCreateError} from "@/filesystem/core/FileCreateError";
import {FileDeleteResult} from "@/filesystem/core/FileDeleteResult";

/**
 * Represents a file stored within the CodalFS. This is constructed from a DirectoryEntry,
 * which contains appropriate information about which blocks to read the data from, along
 * with the file length, name, and parent.
 */
export abstract class File {

    constructor(public data: ArrayBuffer | null, public meta: DirectoryEntry) {

    }

    async convertToBlob(): Promise<Blob> {
        let blob: Blob;

        if (this instanceof Directory) { // Create a zip if we're a directory
            const zip = new JSZip();

            const addDirectoryFiles = (dir: Directory, path: string) => {
                const files = dir.getAllFiles(true);

                files.forEach(file => {
                    const filePath = path + "/" + file.meta.fileName;

                    if (file instanceof Directory) {
                        zip.folder(filePath);
                        addDirectoryFiles(file, filePath);
                    } else {
                        zip.file(filePath, file.data as ArrayBuffer);
                    }
                });
            };

            addDirectoryFiles(this, "");

            blob = await zip.generateAsync({type: "blob"});

        } else if (this.data == null) {
            console.log("Unable to download file as data is null");
            return new Blob();

        } else {
            blob = new Blob([new Uint8Array(this.data)], {type: "octet/stream"});
        }

        return blob;
    }

    async toDataURI(): Promise<string> {
        const reader = new FileReader();

        reader.readAsDataURL(await this.convertToBlob());

        return new Promise(resolve => {
            reader.onloadend = () => {
                resolve(reader.result as string);
            };
        });
    }

    async download() {
        const blob = await this.convertToBlob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = this.meta.fileName;

        document.body.appendChild(a);

        a.click();
        window.URL.revokeObjectURL(url);
    }
}

/**
 * Represents a directory within the filesystem. As, internally, directories are specialised
 * files, this inherits all functionality from the base File class.
 *
 * The contents within this file, being a list of directory entries, should be parsed automatically
 * into 'entries'
 */
export abstract class Directory extends File {

    constructor(meta: DirectoryEntry, public entries: DirectoryEntry[]) {
        super(null, meta);

        this.entries.forEach(e => e.parent = this); // todo better way of doing this?
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