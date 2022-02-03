export class MemorySpan {

    data: DataView;
    readIndex: number = 0;

    constructor(data: DataView) {
        this.data = data;
    }

    readString(length: number) : string {
        const slice = new Int8Array(this.data.buffer.slice(this.readIndex, this.readIndex + length));

        this.skip(length);

        let str = Buffer.from(slice).toString("utf-8");

        const nullChar = str.indexOf("\0"); // trim if we're null terminated early

        if (nullChar) {
            str = str.substring(0, nullChar);
        }

        return str;
    }

    readInt16() : number {
        return this.data.getInt16(this.skip(2), true);
    }

    readInt32() : number {
        return this.data.getInt32(this.skip(4), true);
    }

    readUint16() : number {
        return this.data.getUint16(this.skip(2), true);
    }

    readUint32() : number {
        return this.data.getUint32(this.skip(4), true);
    }

    skip(bytes: number) {
        const currentReadIndex = this.readIndex;

        this.readIndex += bytes;

        return currentReadIndex;
    }
}