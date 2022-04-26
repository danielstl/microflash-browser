<template>
  <div>
    <button id="debug-button" @click="visible = true">Debug</button>
    <Modal title="Debug" v-if="visible" id="root-modal">
      <div>Load filesystem from dump</div>
      <input type="file" @change="ev => this.$emit('handle-file-select', ev)">
      <button @click="this.$emit('dump-filesystem')">Dump current filesystem</button>
      <button @click="dumpBinaryPatch">Dump binary patch</button>
      <div>Apply binary patch</div>
      <input type="file" @change="handleDumpRestore">
      <button @click="connectToDAPLink">Connect to DAPLink</button>
      <div>Block view</div>
      <div id="block-view">
        <div class="block" v-for="(block, ix) in getBlocks()" @click="displayBlockContent(ix)" :title="ix * this.filesystem.flash.blockSize + ' - ' + (((ix + 1) * this.filesystem.flash.blockSize) - 1)" :key="ix" :style="{backgroundColor: block === 65535 ? '#ccc' : block === 61439 ? 'orange' : block === 0 ? 'red' : 'lightblue'}">
          <div class="block-id">{{ ix }}</div>
          <div>{{ block === 65535 ? "-" : block === 61439 ? "EOF" : block === 0 ? "DEL" : block }}</div>
        </div>
      </div>
      <template v-slot:buttons>
        <button @click="visible = false">Hide</button>
      </template>
    </Modal>
  </div>
</template>

<script>
import Modal from "@/components/Modal";
import {MicroflashFilesystem} from "@/filesystem/codalfs/MicroflashFilesystem";
import {MemorySpan} from "@/filesystem/utils/MemorySpan";

export default {
  name: "DebugView",
  components: {Modal},
  props: {
    filesystem: MicroflashFilesystem
  },
  data() {
    return {
      visible: false
    }
  },
  methods: {
    getBlocks() {
      let size = (this.filesystem.fileAllocationTable.fileTableSize * this.filesystem.flash.blockSize) / 2;
      let blocks = [];

      for (let i = 0; i < size; i++) {
        blocks.push(this.filesystem.fileAllocationTable.getBlockInfo(i));
      }

      return blocks;
    },
    dumpBinaryPatch() {
      let patch = this.filesystem.flash.changesAsPatch;
      patch.download("FS_PATCH.dat");
    },
    handleDumpRestore(e) {
      const file = e.target.files[0];
      let reader = new FileReader();

      reader.onload = () => {
        this.filesystem.flash.applyPatch(new MemorySpan(reader.result));
      }

      reader.readAsArrayBuffer(file);
    },
    async connectToDAPLink() {
      const daplink = await this.filesystem.connectToDapLink();

      console.log(daplink);

      const data = MemorySpan.empty(100000);

      data.writeUint8(3);

      await daplink.flash(data.data, this.filesystem.flash.pageSize);

      //let op = new DAPOperation()
      //let webusb = new MicrobitWebUSBConnection();

      //let res = await webusb.connect();

      //alert(res);

      //webusb.flash();
    },
    displayBlockContent(blockIndex) {
      alert(this.filesystem.flash.getBlock(blockIndex).asUtf8String());
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