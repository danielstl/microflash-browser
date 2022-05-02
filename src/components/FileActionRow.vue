<template>
<div id="actions-container">
  <div id="search">
    <input type="text" v-model="search" placeholder="Search for a file..."/>
  </div>
  <div id="action-buttons">
    <transition-group name="slide-in">
      <button :key="'delete'" @click="this.$emit('delete')" v-if="canDelete">Delete</button>
      <button :key="'edit'" @click="this.$emit('edit')" v-if="canEdit">Edit</button>
      <button :key="'delete'" @click="this.$emit('download')" v-if="canDownload">Download</button>
      <button :key="'new'" @click="this.$emit('new')">New...</button>
    </transition-group>
  </div>
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
  data() {
    return {
      search: ""
    }
  },
  watch: {
    search(newVal) {
      this.$emit("search", newVal);
    }
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

#search {
  flex: 1;
  display: flex;
}

#action-buttons {
  flex: 1;
  display: flex;
  justify-content: right;
}

#action-buttons > * {
  transition: all 0.3s ease-in-out;
}

#search > input {
  flex: 1;
}

.slide-in-enter-active,
.slide-in-leave-active {
  transition: all 0.1s ease-in-out;
}

.slide-in-enter-from,
.slide-in-leave-to {
  opacity: 0;
}

.slide-in-leave-active {
  position: absolute;
}
</style>