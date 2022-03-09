<template>
  <div class="dir-entry">
    <FileBreadcrumbs :path="directory.meta.fullyQualifiedFileName" @navigate-to-breadcrumb="navigateToBreadcrumb"/>

    <div v-if="directory.parent" class="file-entry file-parent" @dblclick="openFile(directory.parent)">
      <div class="file-name">..</div>
      <div class="file-desc">parent</div>
    </div>

    <Tooltip class="file-entry" v-for="(entry, ix) in directory.validEntries" :key="ix" :text="entry.fileName + '\n' + entry.flags" @dblclick="openFile(entry)"
             @click="previewFile(entry)">
      <div class="file-name">{{ entry.fileName }}</div>
      <div class="file-size" v-if="!entry.isDirectory()">{{ formatBytes(entry.length) }}</div>
      <div class="file-desc">{{ entry.isDirectory() ? "directory" : "file" }}</div>
      <div class="file-operations">
        <button class="file-operation" @click="deleteFile(entry)">Delete</button>
        <button class="file-operation" @click="editFile(entry)">Edit</button>
        <button class="file-operation" @click="downloadFile(entry)">Download</button>
      </div>
    </Tooltip>

    <div v-if="directory.entries.length === 0">
      This folder is empty
    </div>
    <button @click="createFile(true)">Create new directory</button>
    <button @click="createFile(false)">Create new file</button>
  </div>
</template>

<script>
import {Directory, DirectoryEntry, File} from "@/filesystem/Filesystem.ts";
import Tooltip from "@/components/Tooltip";
import FileBreadcrumbs from "@/components/FileBreadcrumbs";

export default {
  name: "FileTree",
  components: {FileBreadcrumbs, Tooltip},
  props: {
    /** @type {Directory} */
    directory: Object // Directory
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
    },
    previewFile(entry) {
      let file = entry instanceof DirectoryEntry ? entry.readData() : entry;

      if (file instanceof Directory) {
        file = null;
      }

      this.$emit("open-file", file);
    },
    createFile(directory) {
      const name = prompt("Enter a " + (directory ? "directory": " file") + " name...") + "\0";

      if (!name) {
        return;
      }

      const res = this.directory.createFile(name, directory);
      alert(res);
    },
    deleteFile(entry) {
      entry.delete();

      alert("Deleted...");
    },
    downloadFile(entry) {
      let file = entry instanceof DirectoryEntry ? entry.readData() : entry;

      file.download();
    },
    editFile(entry) {
      const data = prompt("File data???");

      entry.writeData(data);
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
.file-entry {
  display: flex;
  background: #efefef;

  cursor: pointer;
  user-select: none;

  gap: 1em;
  padding: 0.3em;

  transition: all 0.2s;
}

.file-entry:hover {
  background: #e1e1e1;
}

.dir-entry {
  display: flex;
  flex-direction: column;
  gap: 0.2em;
  flex: 1;
}

.file-operations {
  display: flex;
}

.file-operation {
  flex: 1;
}

.file-name {
  flex: 1;
}
</style>