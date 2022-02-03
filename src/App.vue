<template>
  <div id="app">
    {{ test }}
    <input type="file" @change="handleFileSelect">
  </div>
</template>

<script>
import {Filesystem} from "@/filesystem/Filesystem";

export default {
  name: 'App',
  components: {},
  data() {
    return {
      filesystem: null
    }
  },
  methods: {
    handleFileSelect(e) {
      const file = e.target.files[0]
      let reader = new FileReader();

      reader.onload = function () {
        let arrayBuffer = new Uint8Array(reader.result);
        console.log(arrayBuffer);

        this.filesystem = new Filesystem(reader.result);
      }

      reader.readAsArrayBuffer(file);
    }
  }
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
