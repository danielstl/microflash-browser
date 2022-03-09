<template>
  <div>
    <div id="file-title">{{ file.meta.fileName }}</div>
    <div id="file-contents">
      {{ contents }}
    </div>
  </div>
</template>

<!--suppress ES6UnusedImports -->
<script>
// eslint-disable-next-line no-unused-vars
import {MemorySpan} from "@/filesystem/MemorySpan.ts";

export default {
  name: "FilePreview",
  props: {
    file: Object // File
  },
  computed: {
    contents() {
      //console.log("contents call", this.file);
      //return this.file?.meta?.fileName;
      //console.log("ABC", this.file);
      return new MemorySpan(this.file.data).readString(this.file.meta.length);
    }
  }
}
</script>

<style scoped>

</style>