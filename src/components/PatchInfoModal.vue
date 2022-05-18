<template>
  <Modal :visible="this.visible" title="Updating your micro:bit...">
    <div id="patch-modal">
      <div>Your files are being synchronised to your micro:bit</div>
      <progress :value="patchProgress" :max="patchTotal"></progress>
      <div>Patch {{ patchProgress }} / {{ patchTotal }}</div>
    </div>
    <template v-slot:buttons>
      <button v-if="complete" @click="this.patchTotal = 0">Close</button>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/components/Modal";

export default {
  name: "PatchInfoModal",
  components: {Modal},
  data() {
    return {
      patchProgress: 0,
      patchTotal: 0
    }
  },
  computed: {
    visible() {
      return this.patchTotal !== 0;
    },
    complete() {
      return this.patchProgress === this.patchTotal && this.patchTotal > 0;
    },
    backgroundProgress() {
      const prog = this.patchTotal === 0 ? 0 : (this.patchProgress / this.patchTotal) * 100;
      //return (100 - prog) + "%";
      return "linear-gradient(90deg, red " + prog + "%, blue " + prog + "%)";
    },
  },
  mounted() {
    window.addEventListener("microbit-file-flash", e => {
      console.log("!!!!", e.detail);
      this.patchProgress = e.detail.patchesComplete;
      this.patchTotal = e.detail.totalPatches;
    });
  }
}
</script>

<style scoped>

#patch-modal {
  ---background: v-bind(backgroundProgress);
  transition: all 0.5s;
}

#patch-modal {
  position: relative;
  text-align: center;
  ---background-image: v-bind(backgroundProgress);
}

progress {
  margin: 0.75em;
}
</style>