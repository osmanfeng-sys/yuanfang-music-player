<script setup lang="ts">
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

function toggleTheme() {
  const next = userStore.theme === 'dark' ? 'light' : 'dark'
  userStore.setTheme(next)
}
</script>

<template>
  <header class="header">
    <div class="header__left">
      <router-link to="/" class="header__logo">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" fill="var(--color-primary)" />
          <path d="M11 22V10l12 6-12 6z" fill="#fff" />
        </svg>
        <span class="header__title">远方音乐</span>
      </router-link>

      <nav class="header__nav">
        <router-link to="/" class="nav-link" :class="{ active: $route.path === '/' }">
          首页
        </router-link>
        <router-link to="/browse" class="nav-link" :class="{ active: $route.path === '/browse' }">
          浏览
        </router-link>
      </nav>
    </div>

    <span class="header__spacer" />

    <div class="header__right">
      <button
        class="header__theme-btn"
        @click="toggleTheme"
        :aria-label="userStore.isDark ? '切换亮色模式' : '切换暗色模式'"
      >
        <svg v-if="userStore.isDark" width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <router-link to="/settings" class="header__settings-btn" aria-label="设置">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </router-link>
    </div>
  </header>
</template>

<style scoped>
/* 悬浮透明顶栏 */
.header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--topbar-height);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 0 var(--page-gutter);
  z-index: 60;
  user-select: none;
}

.header__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.header__logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
}

.header__title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.92);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}

.header__nav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: var(--spacing-md);
}

.nav-link {
  padding: 5px 18px;
  font-size: 12px;
  border-radius: 4px;
  color: #fff;
  background: var(--glass-bg-strong);
  backdrop-filter: blur(2px);
  transition: background var(--transition-fast);
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.3);
  color: #fff;
}

.nav-link.active {
  background: var(--accent);
  color: #fff;
}

/* 顶栏中部留白：搜索框已移除，核心入口在主页按钮条（对齐参考站） */
.header__spacer {
  flex: 1;
}

.header__right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.header__theme-btn,
.header__settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.85);
  background: var(--glass-bg-strong);
  backdrop-filter: blur(2px);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.header__theme-btn:hover,
.header__settings-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  color: #fff;
}

@media (max-width: 767px) {
  .header__nav {
    display: none;
  }
  .header__title {
    font-size: 17px;
  }
}
</style>
