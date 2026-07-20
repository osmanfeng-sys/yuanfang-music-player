<script setup lang="ts">
// NotFoundView — 404 页面
</script>

<template>
  <main class="not-found">
    <h1>404</h1>
    <p>页面未找到</p>
    <router-link to="/">返回首页</router-link>
  </main>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: var(--text-primary);
  background: var(--bg-primary);
}
</style>
