<template>
  <div class="dir-entry">
    <b>{{ directory.meta.fullyQualifiedFileName }}</b>

    <div v-if="directory.parent" class="file-entry file-parent" @dblclick="openFile(directory.parent)">
      <div class="file-name">..</div>
      <div class="file-desc">parent</div>
      <div class="file-size">{{ directory.parent.meta.length }}</div>
    </div>

    <Tooltip class="file-entry" v-for="(entry, ix) in directory.validEntries" :key="ix" :text="entry.fileName + '\n' + entry.flags" @dblclick="openFile(entry)"
             @click="previewFile(entry)">
      <div class="file-name">{{ entry.fileName }}</div>
      <div class="file-desc">{{ entry.isDirectory() ? "directory" : "file" }}</div>
      <div class="file-size">{{ entry.length }}</div>
      <div class="file-operations">
        <button class="file-operation" @click="deleteFile(entry)">Delete</button>
        <button class="file-operation" @click="editFile(entry)">Edit</button>
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

export default {
  name: "FileTree",
  components: {Tooltip},
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

      alert("AAAAAAA");
    },
    editFile(entry) {
      const data = prompt("File data???");

      entry.writeData(data);
    },
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