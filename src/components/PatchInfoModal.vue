<template>
  <Modal :visible="this.visible" title="Updating your micro:bit..." style="z-index: 999999">
    <div>Your files are being synchronised to your micro:bit</div>
    <div>Patch {{ patchProgress }} / {{ patchTotal }}</div>
    <progress :value="patchProgress" :max="patchTotal"></progress>
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
    }
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

</style>