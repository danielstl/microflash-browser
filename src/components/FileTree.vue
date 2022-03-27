<template>
  <div>
    <header>Your micro:bit files</header>

    <div class="dir-entry">
      <FileActionRow :selected-files="selectedFiles" @delete="deleteSelectedFiles" @edit="editSelectedFile" @download="downloadSelectedFiles"/>

      <FileBreadcrumbs :path="directory.meta.fullyQualifiedFileName" @navigate-to-breadcrumb="navigateToBreadcrumb"/>

      <Tip :id="'drag-drop'">You can drag and drop files or directories to your file explorer to download them instantly!</Tip>

      <DirectoryEntry v-for="entry in directory.validEntries" :entry="entry" :selected="isSelected(entry)" :key="entry.fileName + entry.firstBlock"
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
import {Directory, DirectoryEntry as DirEntry, File} from "@/filesystem/Filesystem.ts";
import FileBreadcrumbs from "@/components/FileBreadcrumbs";
import FileActionRow from "@/components/FileActionRow";
import DirectoryEntry from "@/components/DirectoryEntry";
import {reactive} from "vue";
import Tip from "@/components/Tip";

export default {
  name: "FileTree",
  components: {Tip, DirectoryEntry, FileActionRow, FileBreadcrumbs},
  props: {
    directory: Directory
  },
  data() {
    return {
      selectedFiles: reactive(new Set()),
      dragDropHint: !window.localStorage.dragDropHint
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
    createFile(directory) {
      const name = prompt("Enter a " + (directory ? "directory" : " file") + " name...") + "\0";

      if (!name) {
        return;
      }

      const res = this.directory.createFile(name, directory);
      alert(res);
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
</style>