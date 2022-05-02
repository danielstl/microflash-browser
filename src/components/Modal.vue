<template>
  <transition name="appear" appear>
    <div class="modal-container" ref="main" v-if="visible && $slots.default">

      <div class="modal-window">
        <div class="modal-title">
          {{ this.title }}
        </div>
        <div class="modal-content">
          <slot>Empty modal</slot>
        </div>
        <div class="modal-footer">
          <slot name="buttons"></slot>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
export default {
  name: "Modal",
  props: {
    title: String,
    visible: Boolean
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        this.$nextTick(() => {
          this.$refs.main.focus();
        });
      }
    }
  }
}
</script>

<style scoped>
.modal-container {
  background: rgba(0, 0, 0, 0.25);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;

  z-index: 999; /* :) */

  justify-content: center;
  align-items: center;

  display: flex;
}

.modal-title {
  font-size: large;
  font-weight: 600;
  background: #31a2e7;

  height: 2.5em;
  display: flex;
  padding: 0 0.5em;
  align-items: center;

  color: white;
}

.modal-content {
  padding: 0.5em;
  background: white;
  border-radius: 8px 8px 0 0;
}

.modal-window {
  background: #31a2e7;
  border-radius: 8px;
  overflow: clip;
  box-shadow: rgba(0, 0, 0, 0.35) 0 4px 12px;
}

.modal-footer {
  display: flex;
  padding: 0.5em;
  justify-content: right;
  background: white;
}

.modal-footer > button {
  -flex: 1;
}

.appear-enter-active, .appear-leave-active {
  transition: all 0.2s cubic-bezier(.05,.54,.43,.97);
}

.appear-enter-from,
.appear-leave-to {
  opacity: 0;
}

.appear-enter-active .modal-window,
.appear-leave-active .modal-window {
  transition: all 0.2s ease-in-out;
}

.appear-enter-from .modal-window,
.appear-leave-to .modal-window {
  transform: scale(0.95);
  opacity: 0;
}

</style>