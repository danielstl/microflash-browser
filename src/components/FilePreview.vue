<template>
  <div id="file-preview" v-if="file">
    <div id="file-title">{{ file.meta.fileName }}</div>
    <div id="file-contents">
      <MonacoEditor v-if="false" v-model="contents" language="html"/>
      <textarea readonly v-model="contents"></textarea>
    </div>
  </div>
  <div id="file-preview-empty" v-else>
    Click on a file to preview it here
  </div>
</template>

<!--suppress ES6UnusedImports -->
<script>
// eslint-disable-next-line no-unused-vars
import {MemorySpan} from "@/filesystem/utils/MemorySpan.ts";
import MonacoEditor from "vue-monaco";

export default {
  name: "FilePreview",
  components: {MonacoEditor},
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
#file-title {
  font-weight: 600;
  font-size: large;
  width: 100%;
  border-bottom: 2px solid #ccc;
  padding-bottom: 0.4em;
}

#file-contents {
  padding-top: 0.4em;
  white-space: pre-line; /* break at \n chars */
  display: flex;

  flex: 1;
}

#file-contents > textarea {
  width: 100%;
  height: 100%;
  resize: none;
  border: none;
  outline: none;
  margin: 0;
  padding: 0;

  flex: 1;
}

#file-preview {
  padding: 0.6em;
  width: 100%;
  display: flex;
  flex-direction: column;
}

#file-preview-empty {
  height: 100%;
  width: 100%;
  align-items: center;
  justify-content: center;
  font-size: large;
  text-align: center;
  display: flex;
}
</style>