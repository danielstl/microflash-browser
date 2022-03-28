import {Directory} from "@/filesystem/core/File";
import {DAPLink, WebUSB} from "dapjs";

/**
 * The filesystem contains a reference to the raw flash data contained
 * within the micro:bit.
 */
export abstract class Filesystem {

    abstract load(): Directory;

    /**
     * Must be called from a user gesture handler
     */
    async connectToDapLink() {
        const device = await navigator.usb.requestDevice({filters: []});

        const transport = new WebUSB(device);
        const daplink = new DAPLink(transport);

        await daplink.connect();

        // @ts-ignore
        window.$daplink = daplink;
    }
}