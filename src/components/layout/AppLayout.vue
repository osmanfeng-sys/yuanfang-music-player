<script setup lang="ts">
import { ref } from 'vue'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'
import AppFooter from './AppFooter.vue'

/** 移动端侧边栏开关 */
const isSidebarOpen = ref(false)

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

function closeSidebar() {
  isSidebarOpen.value = false
}
</script>

<template>
  <div class="layout">
    <AppHeader @toggle-sidebar="toggleSidebar" />

    <div class="layout__body">
      <AppSidebar :is-open="isSidebarOpen" @close="closeSidebar" />

      <main class="layout__content">
        <router-view />
      </main>
    </div>

    <AppFooter />
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg-primary);
}

.layout__body {
  display: flex;
  flex: 1;
  padding-top: var(--header-height);
  padding-bottom: var(--footer-height);
}

.layout__content {
  flex: 1;
  margin-left: 0;
  min-height: calc(100vh - var(--header-height) - var(--footer-height));
  overflow-y: auto;
}

/* 桌面端预留侧边栏宽度 */
@media (min-width: 768px) {
  .layout__content {
    margin-left: var(--sidebar-width);
  }
}
</style>
