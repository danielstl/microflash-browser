<template>
<div id="hex-view">
  <div id="text-view">
    {{ data }}
  </div>
  <div id="hex-view">
    {{ hexData }}
  </div>
</div>
</template>

<script>
export default {
  name: "HexViewer",
  props: {
    data: String
  },
  computed: {
    hexData() {
      return this.data.split("")
          .map(c => c.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase())
          .join(" ");
    }
  }
}
</script>

<style scoped>
#hex-view {
  display: flex;
  user-select: text;
  font-family: monospace, serif;
}

#text-view {
  word-break: break-all;
  flex: 1;
}

#hex-view {
  flex: 3;
}
</style>