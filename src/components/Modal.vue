<template>
<div class="modal-container">
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
</template>

<script>
export default {
  name: "Modal",
  props: {
    title: String
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
  background: #f6f6f6;
  border-bottom: 1px solid #d7d7d7;
  padding: 0.5em;
}

.modal-content {
  padding: 0.5em;
}

.modal-window {
  background: white;
  border-radius: 23px;
  overflow: clip;
  border: 2px solid #353b42;
  box-shadow: rgba(0, 0, 0, 0.2) 0 4px 12px;
}

.modal-footer {
  display: flex;
  padding: 0.5em;
  justify-content: right;
}

.modal-footer > button {
  -flex: 1;
}
</style>