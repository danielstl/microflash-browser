import {DAPWrapper} from "@/filesystem/webusb/dap-wrapper";
import {MemorySpan} from "@/filesystem/utils/MemorySpan";
import {FlashWritable} from "@/filesystem/core/FlashWritable";
import {Patch} from "@/filesystem/codalfs/FlashManager";

const UBIT_COMMAND_BUFFER_ADDRESS = 536903884;
const UBIT_COMMAND_BUFFER_SIZE = 256;
const UBIT_COMMAND_BUFFER_WORDS = UBIT_COMMAND_BUFFER_SIZE / 4;
const UBIT_COMMAND_PAYLOAD_SIZE = UBIT_COMMAND_BUFFER_SIZE - 1;

const UBIT_COMMAND_OP_WRITE_PATCH = 1;

const UBIT_COMMAND_OP_READY = 9;

export class DeviceManager {

    connected: boolean = false;

    private dapWrapper: DAPWrapper | null = null;

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

            // todo hack!
            // writing multiple times seems to increase the likelihood of it working...

            // write the command payload
            this.dapWrapper?.writeBlockAsync(UBIT_COMMAND_BUFFER_ADDRESS + 4, contentBuffer);
            this.dapWrapper?.writeBlockAsync(UBIT_COMMAND_BUFFER_ADDRESS + 4, contentBuffer);
            this.dapWrapper?.writeBlockAsync(UBIT_COMMAND_BUFFER_ADDRESS + 4, contentBuffer);

            // ... and then the opcode
            this.dapWrapper?.writeBlockAsync(UBIT_COMMAND_BUFFER_ADDRESS, opCodeBuffer);
        }
    }

    async publishPatches(patches: Patch[]) {

        // command opcode:  1 byte
        // patch position:  4 bytes
        // patch length:    1 byte
        // patch data:      1-250 bytes

        const patchCommands = patches.flatMap(patch => patch.split(250)).map(patch => new WritePatchCommand(patch));

        DeviceManager.publishPatchEvent(patchCommands.length, 0);

        let i = 0;
        for (const patch of patchCommands) { // run separately so we can report our progress
            await this.sendCommands(patch);

            DeviceManager.publishPatchEvent(patchCommands.length, ++i);
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

            // poll the memory every 20ms, until the first byte indicates that it is ready
            const interval = setInterval(async () => {

                if (!this.dapWrapper) {
                    reject(new Error("Not connected to WebUSB"));
                    return;
                }

                const res = new DataView((await this.dapWrapper.readBlockAsync(UBIT_COMMAND_BUFFER_ADDRESS, 1)).buffer);

                if (res.getUint8(0) === UBIT_COMMAND_OP_READY) { // ready!
                    console.log("READY!!", res.buffer);
                    clearInterval(interval);

                    resolve(undefined);
                }

            }, 20);
        });
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