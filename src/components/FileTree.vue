<template>
  <div>
    <header>Your micro:bit files</header>

    <Modal v-if="creatingFile" title="Create file">
      <form id="create-file-form">
        <div class="form-section">
          <div class="label">File type</div>
          <input id="radio-file" type="radio" value="file" v-model="createdFileType"/>
          <label for="radio-file">File</label>
          <input id="radio-dir" type="radio" value="directory" v-model="createdFileType"/>
          <label for="radio-dir">Directory</label>
        </div>
        <div class="form-section">
          <div class="label">File name</div>
          <div v-if="createdFileNameInvalid">
            File name is invalid
          </div>
          <input type="text" id="file-name" maxlength="16" v-model="createdFileName"/>
        </div>
      </form>
      <template v-slot:buttons>
        <button @click="creatingFile = false">Cancel</button>
        <button @click="submitCreatedFile" :disabled="createdFileNameInvalid || createdFileName === ''">OK</button>
      </template>
    </Modal>

    <Modal v-if="editingFile" :title="'Edit ' + editingFile.meta.fileName">
      <textarea v-model="editingFileText"></textarea>
      <template v-slot:buttons>
        <button @click="editingFile = null">Cancel</button>
        <button @click="submitEditedFile">OK</button>
      </template>
    </Modal>

    <div class="dir-entry">
      <FileActionRow :selected-files="selectedFiles" @new="createFile" @delete="deleteSelectedFiles"
                     @edit="editSelectedFile" @download="downloadSelectedFiles"/>

      <FileBreadcrumbs :path="directory.meta.fullyQualifiedFileName" @navigate-to-breadcrumb="navigateToBreadcrumb"/>

      <Tip :id="'drag-drop'">You can drag and drop files or directories to your file explorer to download them
        instantly!
      </Tip>

      <DirectoryEntry v-for="entry in directory.validEntries" :entry="entry" :selected="isSelected(entry)"
                      :key="entry.fileName + entry.firstBlock"
                      @file-selected="selectFile(entry)"
                      @file-open="openFile(entry)"
                      @file-preview="previewFile(entry)"
      />

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
      editingFileText: ""
    }
  },
  watch: {
    // eslint-disable-next-line no-unused-vars
    createdFileName(newVal) {
      // todo validate
    }
  },
  methods: {
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

      this.directory.modifyFile(file.meta, content);

      this.editingFile = null;
      this.editingFileText = "";
    },
    deleteSelectedFiles() {
      this.selectedFiles.forEach(f => f.delete());
      this.selectedFiles.clear();
    },
    downloadSelectedFiles() {
      this.selectedFiles.forEach(f => f.readData().download());
    },
    editSelectedFile() {
      const data = prompt("File data???");

      this.selectedFiles[0].writeData(data);
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
</style>