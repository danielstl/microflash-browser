<template>
<div>
  <span class="breadcrumb-container" v-for="(elem, ix) in splitPath" :key="ix">
    <span class="breadcrumb" @click.prevent="navigateTo(ix)">{{ elem }}</span>
  </span>
</div>
</template>

<script>
export default {
  name: "FileBreadcrumbs",
  props: {
    path: String
  },
  computed: {
    splitPath() {
      return this.path.split("/");
    }
  },
  methods: {
    navigateTo(breadcrumbIndex) {
      this.$emit("navigate-to-breadcrumb", breadcrumbIndex);
    }
  }
}
</script>

<style scoped>
.breadcrumb-container:not(:first-child)::before {
  content: "/";
  margin-left: 0.1em;
  margin-right: 0.1em;
  color: #777;
}

.breadcrumb {
  margin: 0.2em 0.5em;
  display: inline-block;
  border-radius: 3px;
  padding: 0.15em;
  user-select: none;
}

.breadcrumb:hover {
  background: #ccc;
  cursor: pointer;
}
</style>