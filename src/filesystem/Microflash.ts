import {MicroflashFilesystem} from "@/filesystem/codalfs/MicroflashFilesystem";
import {DeviceManager} from "@/filesystem/webusb/DeviceManager";

export class Microflash {

    constructor(public filesystem: MicroflashFilesystem, public device: DeviceManager) {

    }
}