<template>
<div id="serial-container">
  <h3>Serial</h3>
  <div id="serial-contents">

  </div>
</div>
</template>

<script>
import {Microflash} from "@/filesystem/Microflash";

export default {
  name: "SerialView",
  props: {
    microflash: Microflash
  },
  mounted() {
  //  this.microflash.device.connected
  }
}
</script>

<style scoped>
#serial-container {
  position: fixed;
  bottom: 0;
  padding: 0.5em;
}
</style>