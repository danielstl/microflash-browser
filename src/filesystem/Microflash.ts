import {MicroflashFilesystem} from "@/filesystem/codalfs/MicroflashFilesystem";
import {DeviceManager} from "@/filesystem/webusb/DeviceManager";
import {MemorySpan} from "@/filesystem/utils/MemorySpan";

export class Microflash {

    constructor(public filesystem: MicroflashFilesystem, public device: DeviceManager) {

    }
}

export class FilesystemMetadata {

    constructor(public pageSize: number, public blockSize: number, public flashSize: number, public commandBufferAddress: number) {

    }

    static fromMemorySpan(span: MemorySpan): FilesystemMetadata {

        return new FilesystemMetadata(span.readUint32(), span.readUint32(), span.readUint32(), span.readUint32());
    }
}