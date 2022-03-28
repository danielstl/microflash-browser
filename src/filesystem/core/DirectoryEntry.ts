import {Directory} from "@/filesystem/core/File";
import * as Constants from "@/filesystem/utils/Constants";
import {MemorySpan} from "@/filesystem/utils/MemorySpan";
import {File} from "@/filesystem/core/File";
import {FileDeleteResult} from "@/filesystem/core/FileDeleteResult";
import {FlashWritable} from "@/filesystem/core/FlashWritable";

/**
 * A directory entry contains metadata about a file or directory, pointing
 * to where the data for it is held to facilitate reading or writing.
 */
export abstract class DirectoryEntry implements FlashWritable {

    constructor(public parent: Directory | null, public fileName: string, public length: number) {

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