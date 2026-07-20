<script setup lang="ts">
defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <!-- 移动端遮罩 -->
  <div
    v-if="isOpen"
    class="sidebar-overlay"
    @click="emit('close')"
  />

  <!-- 侧边栏 -->
  <aside class="sidebar" :class="{ 'sidebar--open': isOpen }">
    <div class="sidebar__header">
      <h2 class="sidebar__title">播放列表</h2>
      <button class="sidebar__close-btn" @click="emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <nav class="sidebar__nav">
      <router-link to="/" class="sidebar__link" @click="emit('close')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>首页</span>
      </router-link>

      <router-link to="/browse" class="sidebar__link" @click="emit('close')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
          <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <span>浏览音乐</span>
      </router-link>

      <router-link to="/search" class="sidebar__link" @click="emit('close')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
          <path d="M16.5 16.5l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <span>搜索</span>
      </router-link>
    </nav>

    <div class="sidebar__section">
      <h3 class="sidebar__section-title">系统播放列表</h3>
      <p class="sidebar__empty">加载中...</p>
    </div>

    <div class="sidebar__section">
      <h3 class="sidebar__section-title">我的歌单</h3>
      <p class="sidebar__empty">暂无自定义歌单</p>
    </div>
  </aside>
</template>

<style scoped>
/* 移动端遮罩 */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 90;
}

/* 侧边栏本体 */
.sidebar {
  position: fixed;
  top: var(--header-height);
  left: 0;
  bottom: var(--footer-height);
  width: var(--sidebar-width);
  background: var(--bg-secondary);
  border-right: 1px solid var(--bg-tertiary);
  display: flex;
  flex-direction: column;
  z-index: 80;
  transition: transform var(--transition-normal);
}

/* 桌面端始终显示 */
@media (min-width: 768px) {
  .sidebar {
    transform: translateX(0) !important;
  }
  .sidebar-overlay {
    display: none !important;
  }
}

/* 移动端默认隐藏 */
.sidebar {
  transform: translateX(-100%);
}

.sidebar--open {
  transform: translateX(0);
}

.sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--bg-tertiary);
}

.sidebar__title {
  font-size: 1rem;
  font-weight: 600;
}

.sidebar__close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

@media (min-width: 768px) {
  .sidebar__close-btn {
    display: none;
  }
}

.sidebar__close-btn:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  padding: var(--spacing-sm);
  gap: 2px;
}

.sidebar__link {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.9rem;
  transition: all var(--transition-fast);
}

.sidebar__link:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.sidebar__link.router-link-active {
  color: var(--text-primary);
  background: var(--bg-tertiary);
  font-weight: 600;
}

.sidebar__section {
  padding: var(--spacing-md);
}

.sidebar__section-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--spacing-sm);
}

.sidebar__empty {
  font-size: 0.85rem;
  color: var(--text-tertiary);
  padding: var(--spacing-sm) 0;
}
</style>
