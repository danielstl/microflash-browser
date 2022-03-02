<template>
  <div id="app">
    <header>micro:flash filesystem</header>
    <div id="filesystem">
      <FileTree v-if="this.currentDirectory" :directory="this.currentDirectory"
                @change-directory="(dir) => this.currentDirectory = dir"
                @open-file="(file) => this.currentFile = file"/>
      <FilePreview v-if="this.currentFile" :file="this.currentFile"/>
      <div v-else>Click on a file to preview it.</div>
    </div>
    <input type="file" @change="handleFileSelect">
    <button @click="dumpFilesystem">Save!</button>
  </div>
</template>

<script>
// eslint-disable-next-line no-unused-vars
import {Filesystem, File as CodalFile, Directory} from "@/filesystem/Filesystem";
import FileTree from "@/components/FileTree";
import FilePreview from "@/components/FilePreview";

export default {
  name: 'App',
  components: {FilePreview, FileTree},
  data() {
    return {
      /** @type {Filesystem | null} */
      filesystem: null,
      /** @type {Array<CodalFile>} */
      files: [],
      /** @type {Directory} */
      currentDirectory: null,
      /** @type {CodalFile} */
      currentFile: null
    }
  },
  methods: {
    handleFileSelect(e) {
      const file = e.target.files[0]
      let reader = new FileReader();

      reader.onload = () => {
        this.filesystem = new Filesystem(reader.result);
        this.currentDirectory = this.filesystem.rootDirectory;
      }

      reader.readAsArrayBuffer(file);
    },
    dumpFilesystem() {
      const blob = new Blob([this.filesystem.flash.data]);
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a')
      a.href = blobUrl;
      a.download = "MICRO_FS";
      a.style.display = 'none';
      document.body.appendChild(a);

      a.click();
      a.remove();
    }
  },
  mounted() {
    window.addEventListener("message", e => {
      let message = e.data;

      if (!message || message.i !== "fs") {
        return;
      }

      let buffer = e.data.d;

      this.filesystem = new Filesystem(buffer);
      this.currentDirectory = this.filesystem.rootDirectory;
    });
  }
};
</script>

<style>
#app {
  font-family: Roboto, "Segoe UI", sans-serif;
}

#filesystem {
  display: flex;
  gap: 0.5em;
}

#filesystem > * {
  flex: 1;
}

header {
  font-size: xx-large;
  font-weight: 600;
}
</style>
