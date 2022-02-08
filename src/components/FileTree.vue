<template>
  <div class="dir-entry">
    <b>{{ directory.meta.fullyQualifiedFileName }}</b>

    <div v-if="directory.parent" class="file-entry file-parent" @dblclick="openFile(directory.parent)">
      <div class="file-name">..</div>
      <div class="file-desc">parent</div>
      <div class="file-size">{{ directory.parent.meta.length }}</div>
    </div>

    <div class="file-entry" v-for="(entry, ix) in directory.validEntries" :key="ix" @dblclick="openFile(entry)" @click="previewFile(entry)">
      <div class="file-name">{{ entry.fileName }}</div>
      <div class="file-desc">{{ entry.isDirectory() ? "directory" : "file" }}</div>
      <div class="file-size">{{ entry.length }}</div>
    </div>
    <div v-if="directory.entries.length === 0">
      This folder is empty
    </div>
    <button @click="createDirectory">Create new directory</button>
  </div>
</template>

<script>
import {Directory, File} from "@/filesystem/Filesystem.ts";

export default {
  name: "FileTree",
  props: {
    /** @type {Directory} */
    directory: Object // Directory
  },
  methods: {
    openFile(entry) {
      let file = entry instanceof File ? entry : entry.readData();

      if (file instanceof Directory) {
        this.$emit("change-directory", file);
      }
    },
    previewFile(entry) {
      let file = entry instanceof File ? entry : entry.readData();

      if (file instanceof Directory) {
        file = null;
      }

      this.$emit("open-file", file);
    },
    createDirectory() {
      const name = prompt("Enter a directory name...");

      if (!name) {
        return;
      }

      this.directory.createFile(name, true);
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
}

.file-name {
  flex: 1;
}
</style>