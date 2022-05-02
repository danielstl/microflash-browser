<template>
  <div id="app">
    <DebugView :filesystem="filesystem" @handle-file-select="handleFileSelect" @dump-filesystem="dumpFilesystem"/>
    <Splitpanes vertical="vertical" id="filesystem" class="default-theme">
      <Pane id="navigator-container">
        <button v-if="false" @click="filesystem.connectToDapLink()">Connect USB</button>
        <FileTree v-if="this.currentDirectory" :directory="this.currentDirectory"
                  @change-directory="(dir) => this.currentDirectory = dir"
                  @open-file="(file) => this.currentFile = file"/>
      </Pane>
      <Pane>
        <FilePreview :file="this.currentFile"/>
      </Pane>
    </Splitpanes>
  </div>
</template>

<script>
// eslint-disable-next-line no-unused-vars
import {File as CodalFile} from "@/filesystem/core/File";
import FileTree from "@/components/FileTree";
import FilePreview from "@/components/FilePreview";
import DebugView from "@/components/DebugView";
import {Splitpanes, Pane} from "splitpanes";
import {MicroflashFilesystem} from "@/filesystem/codalfs/MicroflashFilesystem";

export default {
  name: 'App',
  components: {DebugView, FilePreview, FileTree, Splitpanes, Pane},
  data() {
    return {
      /** @type {MicroflashFilesystem | null} */
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
        this.filesystem = new MicroflashFilesystem(reader.result);
        this.currentDirectory = this.filesystem.rootDirectory;
      }

      reader.readAsArrayBuffer(file);
    },
    dumpFilesystem() {
      const blob = new Blob([this.filesystem.flash.data]);
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a')
      a.href = blobUrl;
      a.download = "MICRO_FS.dat";
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

      this.filesystem = new MicroflashFilesystem(buffer);
      this.currentDirectory = this.filesystem.rootDirectory;
    });
  }
};
</script>

<style>
html, body, #app, textarea {
  font-family: Helvetica Now, Helvetica, Arial, sans-serif;
}

html, body, #app {
  height: 100%;
  width: 100%;
  margin: 0;

  user-select: none;
}

#filesystem {
  display: flex;

  height: 100%;
}

.splitpanes__pane {
  display: flex;
}

.splitpanes__splitter {
  width: 5px;
  padding: 0;
  background-image: linear-gradient(90deg, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0));
  background-clip: content-box;
  cursor: col-resize;
}

#navigator-container {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

button {
  cursor: pointer;
  border-radius: 23px;
  min-height: 46px;
  font-weight: 700;
  font-size: 15px;
  padding: 0 16px;

  /* Secondary buttons */
  color: #000;
  border: 2px solid #000;
  background: #fff;

  outline: 2px solid transparent;

  margin: 0 0 0 0.2em;

  transition: all 0.2s;
}

button:hover:not(:disabled) {
  --transform: scale(1.05);
}

button:active:hover:not(:disabled) {
  transform: scale(0.9);
}

button:focus {
  outline: 2px solid #3eb6fd;
}

button:disabled {
  opacity: 0.4;
  cursor: default;
}

input[type=text] {
  background: white;
  font-size: 15px;

  border: 1px solid #dadada;
  padding: 0.5em;
  border-radius: 6px;

  outline: 2px solid transparent;

  transition: all 0.2s;
}

input[type=text]:focus {
  outline: 2px solid #3eb6fd;
}

.inline-warn {
  background: rgba(245, 77, 77, 0.8);
  padding: 0.25em;
  border-left: 3px solid #d20000;
  border-radius: 3px;
}
</style>
