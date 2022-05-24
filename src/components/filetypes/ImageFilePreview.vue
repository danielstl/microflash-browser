<template>
  <div>
    <div id="image-container">
      <input type="checkbox" v-for="i in width * height" :key="i" :name="i"/>
    </div>
  </div>
</template>

<script>
import {File} from "@/filesystem/core/File";

export default {
  name: "ImageFilePreview",
  props: {
    file: File,
    readOnly: Boolean
  },
  data() {
    return {
      width: 5,
      height: 5
    }
  },
  computed: {
    cssWidth() {
      return "1fr ".repeat(this.width);
    },
    cssHeight() {
      return "1fr ".repeat(this.height);
    }
  }
}
</script>

<style scoped>
#image-container {
  display: grid;
  grid-template-columns: v-bind(cssWidth);
  grid-template-rows: v-bind(cssHeight);
}
</style>