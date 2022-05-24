import {DAPWrapper} from "@/filesystem/webusb/dap-wrapper";
import {MemorySpan} from "@/filesystem/utils/MemorySpan";
import {FlashWritable} from "@/filesystem/core/FlashWritable";
import {Patch} from "@/filesystem/codalfs/FlashManager";

const UBIT_COMMAND_BUFFER_SIZE = 256;
const UBIT_COMMAND_BUFFER_WORDS = UBIT_COMMAND_BUFFER_SIZE / 4;
const UBIT_COMMAND_PAYLOAD_SIZE = UBIT_COMMAND_BUFFER_SIZE - 1;

const UBIT_COMMAND_OP_WRITE_PATCH = 0x01;
const UBIT_COMMAND_OP_REMOUNT = 0x02;
const UBIT_COMMAND_OP_ERASE_PAGE = 0x03;
const UBIT_COMMAND_OP_FORMAT = 0x04;

const UBIT_COMMAND_OP_RESPONSE_SUCCESS = 0xFF;

export class DeviceManager {

    connected: boolean = false;

    private dapWrapper: DAPWrapper | null = null;

    constructor(public commandBufferAddress: number) {

    }

    async connect() {
        if (this.connected) { // todo reconnect if needed
            return;
        }

        if (!this.dapWrapper) {
            const device = await this.promptForDevice();

            this.dapWrapper = new DAPWrapper(device);
        }

        await this.dapWrapper.reconnectAsync(); // todo check if already connected?
        this.connected = true;
    }

    debug_promptForWebUSBLocation() {
        const res = prompt("WebUSB interface location? (check serial)");

        if (res != null) {
            this.commandBufferAddress = parseInt(res);
        }
    }

    promptForDevice(): Promise<USBDevice> {
        return navigator.usb.requestDevice({filters: [{vendorId: 0x0d28, productId: 0x0204}]});
    }

    /**
     * Sends a command to the micro:bit, by pushing it to the shared 256-byte memory region
     * @param commands the command(s) to send
     */
    async sendCommands(...commands: MicrobitCommand[]): Promise<void> {
        await this.connect();

        for (const command of commands) {
            const readyPromise = this.waitForReady();

            const commandBuffer = MemorySpan.empty(UBIT_COMMAND_BUFFER_SIZE);
            command.writeToFlash(commandBuffer);

            // we write out the payload portion of the command first, and then follow that with
            // by writing the opcode in a second write. This way, any potential race issues are
            // avoided if the micro:bit processes the command before it has finished being written

            // todo this could still (maybe) cause a race issue with first 3 bytes?

            const commandOffset = 4; // don't write the first word

            const contentBuffer = new Uint32Array(commandBuffer.data.buffer.slice(commandOffset));
            const opCodeBuffer = new Uint32Array(commandBuffer.data.buffer.slice(0, commandOffset));

            await readyPromise;

            // write the command payload
            await this.dapWrapper?.writeBlockAsync(this.commandBufferAddress + 4, contentBuffer);

            // ... and then the opcode
            await this.dapWrapper?.writeBlockAsync(this.commandBufferAddress, opCodeBuffer);
        }
    }

    async publishPatches(patches: Patch[], pagesToClear: number[], refreshOnComplete = false) {

        // command opcode:  1 byte
        // patch position:  4 bytes
        // patch length:    1 byte
        // patch data:      1-250 bytes

        const patchCommands: MicrobitCommand[] = pagesToClear.map(page => new ClearPageCommand(page));

        patchCommands.push(...patches.flatMap(patch => patch.split(248)).filter(patch => !new MemorySpan(patch.data).isFilledWith(0xFF)).map(patch => new WritePatchCommand(patch)));

        DeviceManager.publishPatchEvent(patchCommands.length, 0);

        let i = 0;
        for (const patch of patchCommands) { // run separately so we can report our progress
            await this.sendCommands(patch);

            if (patch instanceof ClearPageCommand) {
                console.log("Cleared page @ " + patch.address);
            } else if (patch instanceof WritePatchCommand) {
                console.log("Published patch @ " + patch.patch.position + ", length: " + patch.patch.data.byteLength + ", data: " + new MemorySpan(patch.patch.data).asString("hex"));
            }

            DeviceManager.publishPatchEvent(patchCommands.length, ++i);
        }

        await this.remount();

        if (refreshOnComplete) {
            setTimeout(() => {
                parent.postMessage("l", "*"); // tell the parent to reload (we can't do this directly as we're cross-origin)
            }, 5000); // todo, we can't reliably guess how long a remount will take...
        }
    }

    private static publishPatchEvent(totalPatches: number, patchesComplete: number) {

        const patchEvent = new CustomEvent("microbit-file-flash", {
            detail: {
                totalPatches: totalPatches,
                patchesComplete: patchesComplete
            }
        });

        window.dispatchEvent(patchEvent);
    }

    /**
     * Polls until the micro:bit is ready to receive a command
     */
    private waitForReady(): Promise<void> {
        return new Promise((resolve, reject) => {

            // poll the memory every 25ms, until the first byte indicates that it is ready
            const interval = setInterval(async () => {

                if (!this.dapWrapper) {
                    reject(new Error("Not connected to WebUSB"));
                    return;
                }

                const res = new DataView((await this.dapWrapper.readBlockAsync(this.commandBufferAddress, 1)).buffer);

                if (res.getUint8(0) === UBIT_COMMAND_OP_RESPONSE_SUCCESS) { // ready!
                    console.log("READY!!", res.buffer);
                    clearInterval(interval);

                    resolve(undefined);
                }

            }, 25);
        });
    }

    public async remount() {
        console.log("Remounting...");
        await this.sendCommands(new RemountCommand());
    }

    public async format() {
        console.log("Formatting the filesystem...");

        await this.sendCommands(new FormatCommand());
        await this.remount();
    }
}

export abstract class MicrobitCommand implements FlashWritable {

    protected constructor(public opCode: number) {

    }

    public writeToFlash(flash: MemorySpan) {
        flash.writeUint8(this.opCode);
    }
}

export class WritePatchCommand extends MicrobitCommand {

    constructor(public patch: Patch) {
        super(UBIT_COMMAND_OP_WRITE_PATCH);
    }

    public writeToFlash(flash: MemorySpan) {
        super.writeToFlash(flash);

        this.patch.writeToFlash(flash);
    }
}

export class RemountCommand extends MicrobitCommand {

    constructor() {
        super(UBIT_COMMAND_OP_REMOUNT);
    }
}

export class ClearPageCommand extends MicrobitCommand {

    constructor(public address: number) {
        super(UBIT_COMMAND_OP_ERASE_PAGE);
    }


    writeToFlash(flash: MemorySpan) {
        super.writeToFlash(flash);

        flash.writeUint32(this.address);
    }
}

export class FormatCommand extends MicrobitCommand {

    constructor() {
        super(UBIT_COMMAND_OP_FORMAT);
    }
}