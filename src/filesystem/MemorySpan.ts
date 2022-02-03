export class MemorySpan {

    data: DataView;
    readIndex: number = 0;

    constructor(data: DataView | ArrayBuffer) {
        console.log("passed data", data);

        if (data instanceof DataView) {
            this.data = data;
        } else {
            this.data = new DataView(data as ArrayBuffer);
        }
    }

    readString(length?: number) : string {
        if (length == undefined) {
            // We don't know how long the string is, so keep reading until we find a null termination

            for (let i = this.readIndex; i < this.data.byteLength; i++) {

                if (this.data.getUint8(i) === 0) { // null byte
                    length = i - this.readIndex;
                    break;
                }
            }

            if (length == undefined) {
                throw new Error("Couldn't find length of string");
            }
        }

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