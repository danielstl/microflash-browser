import {DirectoryEntry} from "@/filesystem/core/DirectoryEntry";

export abstract class File {

    constructor(public data: ArrayBuffer | null, public meta: DirectoryEntry) {

    }

    abstract convertToBlob(): Promise<Blob>;

    abstract toDataURI(): Promise<string>;

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