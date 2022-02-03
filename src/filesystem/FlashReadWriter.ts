import {MemorySpan} from "./MemorySpan";

export class FlashReadWriter {

    flashStart = 0;
    flashEnd = 0;
    pageSize = 1024;
    blockSize = 512;
    flashSize = 131072;

    data: ArrayBuffer;
    dataView: DataView;

    constructor(data: ArrayBuffer) {
        this.data = data;
        this.dataView = new DataView(this.data);
    }

    read(source: number, length: number): ArrayBuffer {
        return this.data.slice(source, source + length);
    }

    readString(source: number, length: number) : string {
        const slice = new Int8Array(this.read(source, length));

        return Buffer.from(slice).toString("utf-8");
    }

    getBlock(blockIndex: number) : MemorySpan {
        return this.getMemorySpan(this.flashStart + blockIndex * this.blockSize, this.blockSize);
    }

    getMemorySpan(source: number, length: number) : MemorySpan {
        return new MemorySpan(new DataView(this.read(source, length)));
    }
}