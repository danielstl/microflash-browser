<template>
<div id="actions-container">
  <button>New...</button>
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
      return this.selectedFiles.size === 1;
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

button {
  cursor: pointer;
  border-radius: 23px;
  min-height: 46px;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.3px;
  padding: 0 16px;

  /* Secondary buttons */
  color: #000;
  border: 2px solid #000;
  background: #fff;

  margin: 0 0 0 0.2em;
}
</style>