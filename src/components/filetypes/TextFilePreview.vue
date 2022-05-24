<template>
  <textarea readonly v-model="contents"></textarea>
</template>

<script>
import {File} from "@/filesystem/core/File";

export default {
  name: "TextFilePreview",
  props: {
    file: File,
    contents: String,
    readOnly: Boolean
  }
}
</script>

<style scoped>

</style>