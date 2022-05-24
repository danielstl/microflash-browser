<template>
  <div>
    <button id="debug-button" @click="visible = true">Debug</button>
    <Modal title="Debug" :visible="visible" id="root-modal">
      <template v-if="visible">
        <HexViewer v-if="false" :data="'test'"/>
        <div class="inline-warn" v-if="!microflash.filesystem">Failed to load filesystem</div>
        <div>Load filesystem from dump</div>
        <input type="file" @change="ev => this.$emit('handle-file-select', ev)">
        <button @click="this.$emit('dump-filesystem')">Dump current filesystem</button>
        <button @click="dumpBinaryPatch">Dump binary patch</button>
        <div>Apply binary patch</div>
        <input type="file" @change="handleDumpRestore">
        <button @click="microflash.device.publishPatches(microflash.filesystem.flash.changesAsPatches, microflash.filesystem.flash.forceRewritePages, true)">Publish patches</button>
        <button @click="microflash.device.debug_promptForWebUSBLocation()">Change WebUSB interface location</button>
        <button @click="microflash.device.remount()">Remount</button>
        <button @click="microflash.device.format()">Format</button>
        <div>Metadata</div>
        <div>Page Size: {{ microflash.filesystem.metadata.pageSize }}, Block Size: {{ microflash.filesystem.metadata.blockSize }}, Flash Size: {{ microflash.filesystem.metadata.flashSize }}, Command Buffer Address: {{ microflash.filesystem.metadata.commandBufferAddress }} / {{ microflash.filesystem.metadata.commandBufferAddress.toString(16) }}</div>
        <div>Block view</div>
        <div id="block-view" v-if="this.microflash.filesystem?.flash">
          <div class="block" v-for="(block, ix) in getBlocks()" @click="displayBlockContent(ix)"
               :title="ix * this.microflash.filesystem.flash.blockSize + ' - ' + (((ix + 1) * this.microflash.filesystem.flash.blockSize) - 1)"
               :key="ix"
               :style="{backgroundColor: block === 65535 ? '#ccc' : block === 61439 ? 'orange' : block === 0 ? 'red' : 'lightblue'}">
            <div class="block-id">{{ ix }}</div>
            <div>{{ block === 65535 ? "-" : block === 61439 ? "EOF" : block === 0 ? "DEL" : block }}</div>
          </div>
        </div>
      </template>
      <template v-slot:buttons>
        <button @click="visible = false">Hide</button>
      </template>
    </Modal>
  </div>
</template>

<script>
/* eslint-disable */
import Modal from "@/components/Modal";
import {MicroflashFilesystem} from "@/filesystem/codalfs/MicroflashFilesystem";
import {MemorySpan} from "@/filesystem/utils/MemorySpan";
import {DAPWrapper} from "@/filesystem/webusb/dap-wrapper";
import HexViewer from "@/components/HexViewer";
import {Microflash} from "@/filesystem/Microflash";

export default {
  name: "DebugView",
  components: {HexViewer, Modal},
  props: {
    microflash: Microflash
  },
  data() {
    return {
      visible: false
    }
  },
  methods: {
    getBlocks() {
      if (!this.microflash.filesystem) {
        return [];
      }

      let size = (this.microflash.filesystem.fileAllocationTable.fileTableSize * this.microflash.filesystem.flash.blockSize) / 2;
      let blocks = [];

      for (let i = 0; i < size; i++) {
        blocks.push(this.microflash.filesystem.fileAllocationTable.getBlockInfo(i));
      }

      return blocks;
    },
    dumpBinaryPatch() {
      let patch = MemorySpan.fromPatches(this.microflash.filesystem.flash.changesAsPatches);
      patch.download("FS_PATCH.dat");
    },
    handleDumpRestore(e) {
      const file = e.target.files[0];
      let reader = new FileReader();

      reader.onload = () => {
        this.microflash.filesystem.flash.applyPatch(new MemorySpan(reader.result));
      }

      reader.readAsArrayBuffer(file);
    },
    async connectToDAPLink() {
      const device = await navigator.usb.requestDevice({filters: []});
      const wrapper = new DAPWrapper(device);

      await wrapper.reconnectAsync();

      const interfaceIndex = parseInt(prompt("address??"));


      /////////////
      /*      const span = MemorySpan.empty(256);

            span.writeUint16(4);

            const buf = new Uint32Array(span.data.buffer);

            await wrapper.writeBlockAsync(interfaceIndex, buf);
      ///////////////////*/

      const patches = this.microflash.filesystem.flash.changesAsPatches.flatMap(patch => patch.split(248));


      /*const patchSizeLimit = 254;

      const patchesAsSpans = [];

      let span = MemorySpan.empty(256);

      let lastPatch = null;

      for (let i = 0; i < patches.length; i++) {
        const patch = patches[i];

        if (span.readIndex >= 250) { // don't start a new patch on this same span!
          patchesAsSpans.push(span);

          span = MemorySpan.empty(256);
        }

        for (let segment = 0; segment < patch.data.length; segment++) {

          span.writeUint32(patch.position);
          span.writeUint8(patch.position);
        }
      }*/

      async function waitForReady() {
        return new Promise((resolve) => {

          const interval = setInterval(async () => {

            const res = new DataView((await wrapper.readBlockAsync(interfaceIndex, 64)).buffer); // 256

            if (res.getUint8(0) === 9) { // ready!
              console.log("READY!!");
              clearInterval(interval);

              resolve();
            }

          }, 10);
        });
      }

      for (const patch of patches) {
        console.log("Writing out patch", patch);

        await waitForReady();

        const span = MemorySpan.empty(256);

        span.writeUint8(1);
        patch.writeToFlash(span);


        //////////////
////////
        ////////      const debugBuf = new Uint8Array(span.data.buffer);
        ////////      // eslint-disable-next-line no-debugger
        ////////      debugger;
        ////////      debugBuf.forEach((val, ix) => console.log("webUsbInterface[" + ix + "] = 0x" + val.toString(16) + ";"));
////////
        ////////      // eslint-disable-next-line no-constant-condition
        ////////      if (true) continue;
////////
        ////////      ///////////
        console.log("patch span", span.data.buffer);

        const buf = new Uint32Array(span.data.buffer.slice(4));


        // eslint-disable-next-line no-debugger
        ///// debugger;
        await wrapper.writeBlockAsync(interfaceIndex + 4, buf); // write buffer before the actual CMD
        await wrapper.writeBlockAsync(interfaceIndex + 4, buf); // ehhhhhhhhhhhhhhhhhhhhh
        await wrapper.writeBlockAsync(interfaceIndex + 4, buf); // ehhhhhhhhhhhhhhhhhhhhh
        // prevent possible race errors??? todo: find a better mutex strat...

        const buf2 = new Uint32Array(span.data.buffer.slice(0, 4));

        await wrapper.writeBlockAsync(interfaceIndex, buf2);
      }

      //const daplink = await this.filesystem.connectToDapLink();

      //console.log(daplink);

      //const data = MemorySpan.empty(100000);

      //data.writeUint8(3);

      //await daplink.flash(data.data, this.filesystem.flash.pageSize);

      //let op = new DAPOperation()
      //let webusb = new MicrobitWebUSBConnection();

      //let res = await webusb.connect();

      //alert(res);

      //webusb.flash();
    },
    displayBlockContent(blockIndex) {
      const block = this.microflash.filesystem.flash.getBlock(blockIndex);
      alert(block.asString("hex") + "\n\n" + block.asString("utf-8"));
    }
  }
}
</script>

<style scoped>
#debug-button {
  position: absolute;
  right: 0;
  opacity: 0.5;
}

#block-view {
  overflow: auto;
}

.block {
  display: inline-flex;
  width: 3em;
  height: 3em;
  margin: 0.1em;
  text-align: center;
  flex-direction: column;
  justify-content: center;
  cursor: pointer;
}

.block-id {
  font-weight: bold;
}
</style>