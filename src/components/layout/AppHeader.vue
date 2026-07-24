<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import SearchBar from '@/components/search/SearchBar.vue'

const userStore = useUserStore()

const emit = defineEmits<{
  'toggle-sidebar': []
}>()

function toggleTheme() {
  const next = userStore.theme === 'dark' ? 'light' : 'dark'
  userStore.setTheme(next)
}
</script>

<template>
  <header class="header">
    <div class="header__left">
      <button class="header__menu-btn" @click="emit('toggle-sidebar')" aria-label="菜单">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>

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

    <div class="header__center">
      <SearchBar />
    </div>

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
