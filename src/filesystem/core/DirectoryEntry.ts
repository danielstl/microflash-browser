import {Directory} from "@/filesystem/core/Directory";
import * as Constants from "@/filesystem/Constants";
import {MemorySpan} from "@/filesystem/MemorySpan";
import {FileDeleteResult} from "@/filesystem/Filesystem";
import {File} from "@/filesystem/core/File";

export abstract class DirectoryEntry {

    constructor(public parent: Directory | null, public fileName: string, public flags: number, public length: number) {

    }

    /**
     * Returns the filename obtained by concatenating this filename to all of its parents' filenames
     */
    get fullyQualifiedFileName(): string {
        let name = this.fileName;
        let parent = this.parent;

        while (parent != null) {
            name = parent?.meta.fileName + Constants.CODALFS_FILE_SEPARATOR + name;
            parent = parent.meta.parent;
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
            parent = parent.meta.parent;
        }

        return breadcrumbs;
    }

    /**
     * Reads the file referenced by this directory entry
     * @returns this entry's file
     */
    abstract readData(): File;

    abstract writeToFlash(flash: MemorySpan): void;

    abstract writeData(toWrite: MemorySpan | string): void

    abstract delete(): FileDeleteResult;

    abstract get isDirectory(): boolean;

    abstract get isValid(): boolean;
}