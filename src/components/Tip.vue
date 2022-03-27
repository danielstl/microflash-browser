<template>
  <div class="tip" v-if="visible">
    <div class="tip-content"><slot></slot></div>
    <button @click="hide">OK</button>
  </div>
</template>

<script>
export default {
  name: "Tip",
  props: {
    id: String
  },
  data() {
    return {
      visible: !window.localStorage["tip_" + this.id]
    }
  },
  methods: {
    hide() {
      window.localStorage["tip_" + this.id] = true;
      this.visible = false;
    }
  }
}
</script>

<style scoped>
.tip {
  background: #3eb6fd;
  color: white;
  padding: 0.8em;
  border-radius: 6px;
  display: flex;
  align-items: center;
}

.tip > .tip-content {
  flex: 1;
}

.tip > button {
  background: none;
  border: 2px solid white;
  border-radius: 23px;
  padding: 0.6em 1em;
  color: white;
  cursor: pointer;

  transition: all 0.2s;
}

.tip > button:hover {

  transform: scale(1.1);
}
</style>