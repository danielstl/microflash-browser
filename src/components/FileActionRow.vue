<template>
<div id="actions-container">
  <button @click="this.$emit('new')">New...</button>
  <button @click="this.$emit('delete')" v-if="canDelete">Delete</button>
  <button @click="this.$emit('edit')" v-if="canEdit">Edit</button>
  <button @click="this.$emit('download')" v-if="canDownload">Download</button>
</div>
</template>

<script>
import {Directory} from "@/filesystem/core/File";

export default {
  name: "FileActionRow",
  props: {
    selectedFiles: Set,
    directory: Directory
  },
  computed: {
    canEdit() {
      return this.selectedFiles.size === 1 && [...this.selectedFiles].every(file => !file.isDirectory);
    },
    canDelete() {
      return this.selectedFiles.size > 0;
    },
    canDownload() {
      return this.selectedFiles.size > 0;
    }
  }
}
</script>

<style scoped>
#actions-container {
  display: flex;
  justify-content: flex-end;
}
</style>