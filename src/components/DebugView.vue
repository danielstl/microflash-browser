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
      <div>Block view</div>
      <div id="block-view">
        <div class="block" v-for="(block, ix) in getBlocks()" :key="ix" :style="{backgroundColor: block === 65535 ? '#ccc' : block === 61439 ? 'orange' : block === 0 ? 'red' : 'lightblue'}">
          {{ ix }}
          {{ block === 65535 ? "N/A" : block === 61439 ? "EOF" : block === 0 ? "DEL" : block }}
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
  display: flex;
  gap: 0.25em;
  overflow: scroll;
}

.block {
  flex: 1;
}
</style>