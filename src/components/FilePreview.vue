<template>
<div>
  {{ contents }}
</div>
</template>

<script>
import {MemorySpan} from "@/filesystem/MemorySpan.ts";

export default {
  name: "FilePreview",
  props: {
    file: Object // File
  },
  computed: {
    contents() {
      console.log("ABC", this.file);
      return new MemorySpan(this.file.data).readString(this.file.meta.length);
    }
  }
}
</script>

<style scoped>

</style>