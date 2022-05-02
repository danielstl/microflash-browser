<template>
  <div id="root" @dragenter="fileDragEnter" @dragover.prevent="fileDragOver" @drop.prevent="fileDrop">
    <header>Your micro:bit files</header>

    <Modal :visible="creatingFile" title="Create file"> <!-- todo refactor into individual components -->
      <template v-if="creatingFile">
        <form id="create-file-form">
          <div class="form-section">
            <div class="label">File type</div>
            <div class="file-types">
              <div class="radio-button">
                <input id="radio-file" type="radio" value="file" v-model="createdFileType"/>
                <label for="radio-file">File</label>
              </div>
              <div class="radio-button">
                <input id="radio-dir" type="radio" value="directory" v-model="createdFileType"/>
                <label for="radio-dir">Folder</label>
              </div>
            </div>
          </div>
          <div class="form-section">
            <div class="label">File name</div>
            <div v-if="createdFileNameInvalid">
              File name is invalid
            </div>
            <input type="text" id="file-name" maxlength="16" autocomplete="off" v-model="createdFileName"/>
          </div>
        </form>
      </template>
      <template v-slot:buttons>
        <button @click="creatingFile = false">Cancel</button>
        <button @click="submitCreatedFile" :disabled="createdFileNameInvalid || createdFileName === ''">OK</button>
      </template>
    </Modal>

    <Modal :visible="editingFile" :title="'Edit ' + editingFile?.meta?.fileName">
      <template v-if="editingFile">
        <!-- todo refactor into individual components -->
        <textarea id="edit-file-textbox" v-model="editingFileText"></textarea>
      </template>
      <template v-slot:buttons>
        <button @click="editingFile = null">Cancel</button>
        <button @click="submitEditedFile">OK</button>
      </template>
    </Modal>

    <div class="dir-entry" @focus="fileTreeHasFocus = true" @blur="fileTreeHasFocus = false"
         @keydown.capture.up="navigateUp" @keydown.capture.down="navigateDown">
      <FileActionRow :selected-files="selectedFiles" @new="createFile" @delete="deleteSelectedFiles"
                     @edit="editSelectedFile" @download="downloadSelectedFiles" @search="searchFiles"/>

      <FileBreadcrumbs :path="directory.meta.fullyQualifiedFileName" @navigate-to-breadcrumb="navigateToBreadcrumb"/>

      <Tip :id="'drag-drop'">You can drag and drop files or directories to your file explorer to download them
        instantly!
      </Tip>

      <!--<transition-group name="dirent" :duration="0">-->
      <DirectoryEntry v-for="entry in directory.validEntries.filter(e => e.fileName.toLowerCase().indexOf(this.search) !== -1)" :entry="entry" :selected="isSelected(entry)"
                      :key="entry.fileName + entry.firstBlock"
                      @file-selected="selectFile(entry)"
                      @file-open="openFile(entry)"
                      @file-preview="previewFile(entry)"
      />
      <!--</transition-group>-->

      <div v-if="directory.validEntries.length === 0" id="empty-directory">
        This folder is empty
      </div>

      <button v-if="false" @click="createFile(true)">Create new directory</button>
      <button v-if="false" @click="createFile(false)">Create new file</button>
    </div>
  </div>
</template>

<script>
import FileBreadcrumbs from "@/components/FileBreadcrumbs";
import FileActionRow from "@/components/FileActionRow";
import DirectoryEntry from "@/components/DirectoryEntry";
import {reactive} from "vue";
import Tip from "@/components/Tip";
import {Directory, File} from "@/filesystem/core/File";
import {DirectoryEntry as DirEntry} from "@/filesystem/core/DirectoryEntry";
import Modal from "@/components/Modal";
import {MemorySpan} from "@/filesystem/utils/MemorySpan";

export default {
  name: "FileTree",
  components: {Modal, Tip, DirectoryEntry, FileActionRow, FileBreadcrumbs},
  props: {
    directory: Directory
  },
  data() {
    return {
      selectedFiles: reactive(new Set()),
      dragDropHint: !window.localStorage.dragDropHint,
      creatingFile: false,
      createdFileType: "file",
      createdFileName: "",
      createdFileNameInvalid: false,
      editingFile: null,
      editingFileText: "",
      fileTreeHasFocus: false,
      mainSelectFocusIndex: -1,
      search: ""
    }
  },
  watch: {
    // eslint-disable-next-line no-unused-vars
    createdFileName(newVal) {
      // todo validate
    },
    editingFile(newVal, oldVal) {
      if (oldVal != null && newVal == null) {
        this.editingFileText = "";
      }
    }
  },
  methods: {
    searchFiles(search) {
      this.search = search.toLowerCase();
    },
    openFile(entry) {
      let file = entry instanceof File ? entry : entry.readData();

      if (file instanceof Directory) {
        this.changeDirectory(file);
      }
    },
    changeDirectory(dir) {
      this.$emit("change-directory", dir);
      this.selectedFiles.clear();
    },
    selectFile(entry) {
      this.selectedFiles.add(entry)
    },
    isSelected(entry) {
      return this.selectedFiles.has(entry);
    },
    previewFile(entry) {
      this.selectedFiles.clear();
      this.selectedFiles.add(entry);

      this.mainSelectFocusIndex = this.directory.validEntries.indexOf(entry);

      let file = entry instanceof DirEntry ? entry.readData() : entry;

      if (file instanceof Directory) {
        file = null;
      }

      this.$emit("open-file", file);
    },
    createFile() {
      /*const name = prompt("Enter a " + (isDirectory ? "directory" : "file") + " name...") + "\0";

      if (!name) {
        return;
      }

      const res = this.directory.createFile(name, isDirectory);
      alert(res);*/

      this.createdFileName = "";
      this.creatingFile = true;
    },
    submitCreatedFile() {
      let name = this.createdFileName + "\0";

      let isDirectory = this.createdFileType === "directory";

      let file = this.directory.createFile(name, isDirectory);

      if (!isDirectory) {
        this.editingFile = file; // jump straight into the editor when creating a file
      }

      this.createdFileName = "";
      this.creatingFile = false;
    },
    submitEditedFile() {
      let file = this.editingFile;
      let content = this.editingFileText;

      this.directory.modifyEntry(file.meta, content);

      this.editingFile = null;
      this.previewFile(file.meta);
    },
    deleteSelectedFiles() {
      this.selectedFiles.forEach(f => f.delete());
      this.selectedFiles.clear();
    },
    downloadSelectedFiles() {
      this.selectedFiles.forEach(f => f.readData().download());
    },
    editSelectedFile() {
      this.selectedFiles.forEach(f => { // todo this is quite hacky as we only want to edit one file at a time
        let file = f.readData();
        this.editingFile = file;
        this.editingFileText = Buffer.from(file.data).toString("utf-8");
      });
    },
    formatBytes(bytes) {
      if (bytes < 1024) {
        return bytes + " B";
      }

      bytes /= 1024;
      return `${bytes.toFixed(2)} KB`;
    },
    navigateToBreadcrumb(breadcrumbIndex) {
      let breadcrumbs = this.directory.meta.breadcrumbs;

      this.changeDirectory(breadcrumbs[breadcrumbIndex].readData());
    },
    fileDragEnter() {

    },
    fileDragOver(ev) {
      ev.dataTransfer.dropEffect = "copy";
    },
    fileDrop(ev) {
      let files = [];

      if (ev.dataTransfer.items) {
        for (let item of ev.dataTransfer.items) {
          if (item.kind !== 'file') {
            continue;
          }

          files.push(item.getAsFile());
        }
      }

      files.forEach(async file => {
        let fileData = await file.arrayBuffer();

        let mbFile = this.directory.createFile(file.name + "\0", false);

        if (mbFile instanceof File) {
          mbFile.meta.writeData(new MemorySpan(fileData));
          return;
        }

        //otherwise it's an error, todo user friendly error
        alert("Error creating file: " + mbFile);
      });
    },
    navigateDown() {
      if (this.mainSelectFocusIndex <= 0) {
        return;
      }

      this.previewFile(this.directory.validEntries[--this.mainSelectFocusIndex]);
    },
    navigateUp() {
      console.log("UP");
      const entries = this.directory.validEntries;
      if (this.mainSelectFocusIndex >= entries.length) {
        return;
      }

      this.previewFile(this.directory.validEntries[++this.mainSelectFocusIndex]);
    }
  }
}
</script>

<style scoped>
.dir-entry {
  display: flex;
  flex-direction: column;
  gap: 0.2em;
  flex: 1;
  padding: 0.3em;
}

header {
  font-size: xx-large;
  font-weight: 600;
  padding: 0.25em;
  color: white;

  background-image: linear-gradient(122deg, #00c800 -3%, #3eb6fd 49%);

  box-shadow: rgba(0, 0, 0, 0.25) 0 4px 12px;

  margin-bottom: 0.25em;
}

#root {
  height: 100%;
}

#empty-directory {
  text-align: center;
}

#file-type {
  background: red;
}

#file-name {
  min-width: 300px;
}

#create-file-form > *:not(:last-child) {
  margin-bottom: 0.3em;
}

.form-section {
  background: #f3f3f3;
  border-radius: 6px;
  padding: 0.5em;
}

.label {
  font-weight: 600;
  margin-bottom: 0.25em;
}

#edit-file-textbox {
  width: 50vw;
  height: 30vh;
}

.file-types {
  display: flex;
  gap: 0.2em;
}

.radio-button {
  flex: 1;
  display: flex;
  background: white;
  border: 1px solid #dadada;
  padding: 0.25em;
  border-radius: 6px;
}

.radio-button > label {
  flex: 1;
}

.radio-button > input[type=radio] {
  ---background: orange;
}

.dirent-enter-active,
.dirent-leave-active {
  --transition: all 0.5s ease;
}

.dirent-enter-from,
.dirent-leave-to {
  opacity: 0;
  --transform: translateX(30px);
}
</style>