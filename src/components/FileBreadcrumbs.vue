<template>
  <div>
    <transition-group name="breadcrumbs">
      <span class="breadcrumb-container" v-for="(elem, ix) in splitPath" :key="ix">
        <span class="breadcrumb" @click.prevent="navigateTo(ix)">{{ elem }}</span>
      </span>
    </transition-group>
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
  margin-left: 0.4em;
  margin-right: 0.4em;
  color: #777;
}

.breadcrumb {
  display: inline-block;
  border-radius: 3px;
  padding: 0.2em;
  user-select: none;

  font-size: large;
  font-weight: 600;

  transition: all 0.2s;
}

.breadcrumb:hover {
  background: #ddd;
  cursor: pointer;
}

.breadcrumbs-enter-active,
.breadcrumbs-leave-active {
  transition: all 0.2s ease-out;
}

.breadcrumbs-enter-from,
.breadcrumbs-leave-to {
  opacity: 0;
}
</style>