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

/* Tooltip text */
.tooltip .tooltip-hover {
  visibility: hidden;
  width: 120px;
  background-color: black;
  color: #fff;
  text-align: center;
  padding: 5px 0;
  border-radius: 6px;

  /* Position the tooltip text - see examples below! */
  position: absolute;
  z-index: 1;
}

/* Show the tooltip text when you mouse over the tooltip container */
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
  }

  100% {
    opacity: 1;
    scale: 1;
  }
}
</style>