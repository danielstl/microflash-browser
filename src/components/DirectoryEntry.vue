<template>
  <Tooltip draggable="true"
           :class="{'file-entry': true, selected}" :text="entry.fileName + '\n' + entry.flags"
           @dblclick="$emit('file-open')"
           @click.exact="$emit('file-preview')"
           @click.ctrl="$emit('file-selected')"
           @dragstart="drag"
           @drop.prevent="drop"
  >
    <div class="file-name">{{ entry.fileName }}</div>
    <div class="file-size" v-if="!entry.isDirectory">{{ formattedSize }}</div>
    <div class="file-desc">{{ entry.isDirectory ? "directory" : "file" }}</div>
  </Tooltip>
</template>

<script>
import {DirectoryEntry} from "@/filesystem/core/DirectoryEntry.ts";
import Tooltip from "@/components/Tooltip";

export default {
  name: "DirectoryEntry",
  components: {Tooltip},
  props: {
    entry: DirectoryEntry,
    selected: Boolean
  },
  data() {
    return {
      downloadURI: null
    }
  },
  computed: {
    formattedSize() {
      let bytes = this.entry.length;
      if (bytes < 1024) {
        return bytes + " B";
      }

      bytes /= 1024;
      return `${bytes.toFixed(2)} KB`;
    }
  },
  watch: {
    entry: {
      immediate: true,
      async handler() {
        const uri = await this.entry.readData().toDataURI();
        this.downloadURI = "application/octet-stream:" + this.entry.fileName + (this.entry.isDirectory ? ".zip" : "") + ":" + uri;
      }
    }
  },
  methods: {
    drag(ev) {
      ev.dataTransfer.setData("DownloadURL", this.downloadURI);
    },
    drop() {

    }
  }
}
</script>

<style scoped>
.file-entry {
  display: flex;
  background: #efefef;

  border-radius: 6px;

  cursor: pointer;
  user-select: none;

  gap: 1em;
  padding: 0.65em 0.4em;

  transition: background-color 0.2s;
}

.file-entry:hover {
  background: #caebe7;
}

.selected {
  outline: 2px solid black;
}

.selected:hover {
  -background: rgb(27, 7, 79);
}

.file-name {
  flex: 1;
}
</style>