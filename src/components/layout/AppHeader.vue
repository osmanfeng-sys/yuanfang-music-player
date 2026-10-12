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
        :title="userStore.isDark ? '当前深色 · 点击切浅色' : '当前浅色 · 点击切深色'"
        :aria-label="userStore.isDark ? '切换亮色模式' : '切换暗色模式'"
      >
        <!-- 半明半暗的对比圆：主题的通用符号，不再是太阳/月亮。
             原来深色模式下显示太阳（"点我切浅色"），而旁边的设置按钮
             误画成了太阳，两个并排就撞脸了。
             保持单一样式不随状态变形，当前模式靠 title 提示。 -->
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
          <path d="M12 3a9 9 0 010 18z" fill="currentColor" />
        </svg>
      </button>

      <router-link to="/settings" class="header__settings-btn" aria-label="设置" title="设置">
        <!-- 齿轮。原来这里画的是「圆 + 八条放射线」，那是个太阳 ——
             跟主题按钮撞了，所以两个图标看着一模一样。 -->
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 003.68 15a1.65 1.65 0 00-1.51-1H2a2 2 0 110-4h.09A1.65 1.65 0 003.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 3.68 1.65 1.65 0 0010 2.17V2a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.14.35.44.6.82.7H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
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
