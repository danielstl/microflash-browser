export class MemorySpan {

    data: DataView;
    readIndex: number = 0;

    constructor(data: DataView | ArrayBuffer) {
        if (data instanceof DataView) {
            this.data = data;
        } else {
            this.data = new DataView(data as ArrayBuffer);
        }
    }

    readString(length?: number): string {
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

        const slice = new Int8Array(this.readArrayBufferSlice(length));

        let str = Buffer.from(slice).toString("utf-8");

        const nullChar = str.indexOf("\0"); // trim if we're null terminated early

        if (nullChar) {
            str = str.substring(0, nullChar);
        }

        return str;
    }

    readInt8(): number {
        return this.data.getInt8(this.skip(1));
    }

    readInt16(): number {
        return this.data.getInt16(this.skip(2), true);
    }

    readInt32(): number {
        return this.data.getInt32(this.skip(4), true);
    }

    readUint8(): number {
        return this.data.getUint8(this.skip(1));
    }

    readUint16(): number {
        return this.data.getUint16(this.skip(2), true);
    }

    readUint32(): number {
        return this.data.getUint32(this.skip(4), true);
    }

    readArrayBufferSlice(length: number): ArrayBuffer {
        const slice = this.data.buffer.slice(this.data.byteOffset + this.readIndex, this.data.byteOffset + this.readIndex + length);

        this.skip(length);

        return slice;
    }

    writeString(value: string, fixedLength: number = -1, nullTerminate: boolean = false) {
        if (fixedLength < 0) {
            fixedLength = value.length;
        }

        for (let i = 0; i < fixedLength; i++) {
            if (i >= value.length) { // buffer with nulls
                this.writeUint8(0);
            } else {
                const char = value.charCodeAt(i);
                this.writeUint8(char);
            }
        }

        if (nullTerminate) {
            this.writeUint8(0);
        }
    }

    writeInt8(value: number) {
        this.data.setInt8(this.skip(1), value);
    }

    writeInt16(value: number) {
        this.data.setInt16(this.skip(2), value, true);
    }

    writeInt32(value: number) {
        this.data.setInt32(this.skip(4), value, true);
    }

    writeUint8(value: number) {
        this.data.setUint8(this.skip(1), value);
    }

    writeUint16(value: number) {
        this.data.setUint16(this.skip(2), value, true);
    }

    writeUint32(value: number) {
        this.data.setUint32(this.skip(4), value, true);
    }

    canRead(bytes: number = 1) : boolean {
        return (this.readIndex + bytes) <= this.data.buffer.byteLength;
    }

    skip(bytes: number) {
        const currentReadIndex = this.readIndex;

        this.readIndex += bytes;

        return currentReadIndex;
    }

    write(span: MemorySpan) {
        new Uint8Array(this.data.buffer, 0, this.data.buffer.byteLength).set(new Uint8Array(span.data.buffer), this.readIndex);

        this.skip(span.data.buffer.byteLength);
    }

    static empty(size: number): MemorySpan {
        const dataBuffer = new Uint8Array(new Array<number>(size).fill(0xFF)); // Set to empty flash

        return new MemorySpan(dataBuffer.buffer);
    }
}