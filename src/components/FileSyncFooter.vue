<template>
  <transition name="slide-up">
    <div id="footer-root" v-if="visible">
      <div>You've made changes to the files on your micro:bit</div>
      <button @click="syncFiles">Save</button>
    </div>
  </transition>
</template>

<script>
export default {
  name: "FileSyncFooter",
  methods: {
    syncFiles() {
      this.$emit("sync-files");
      this.visible = false;
    }
  },
  data() {
    return {
      visible: false
    }
  },
  mounted() {
    window.addEventListener("microbit-fs-dirty", () => {
      this.visible = true;
    });

    window.onbeforeunload = () => this.visible ? "" : undefined;
  }
}
</script>

<style scoped>
@keyframes background-pulse {
  from {
    background: #31a2e7;
  }

  to {
    background: #1b7ab6;
  }
}

#footer-root {
  background: green;
  border-radius: 8px;
  padding: 0.8em;
  margin: 0.5em;

  color: white;

  display: flex;

  align-items: center;

  animation: background-pulse 2s infinite alternate;
}

#footer-root > div {
  flex: 1;
}

.slide-up-enter-active, .slide-up-leave-active {
  transition: all 0.2s cubic-bezier(.05,.54,.43,.97);
}

.slide-up-enter-from, .slide-up-leave-to {
  opacity: 0;
}

.slide-up-enter-active, .slide-up-leave-active {
  transition: all 0.2s ease-in-out;
}

.slide-up-enter-from, .slide-up-leave-to {
  transform: scale(0.95);
  opacity: 0;
}
</style>