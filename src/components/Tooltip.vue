<template>
<div class="tooltip">
  <slot></slot>
  <span class="tooltip-hover">{{ text }}</span>
</div>
</template>

<script>
export default {
  name: "Tooltip",
  props: {
    text: String
  }
}
</script>

<style scoped>
/* Tooltip container */
.tooltip {
  position: relative;
  display: inline-block;
}

.tooltip .tooltip-hover {
  visibility: hidden;

  width: 120px;
  background-color: black;
  color: #fff;
  text-align: center;
  padding: 5px 0;
  border-radius: 6px;

  position: absolute;
  z-index: 1;
}

.tooltip:hover .tooltip-hover {
  visibility: visible;

  animation: tooltip-appear 0.2s;
  animation-delay: 1s;
  animation-fill-mode: backwards;
}

@keyframes tooltip-appear {

  0% {
    opacity: 0;
    scale: 0.9;
    pointer-events: none;
  }

  100% {
    opacity: 1;
    scale: 1;
    pointer-events: auto;
  }
}
</style>