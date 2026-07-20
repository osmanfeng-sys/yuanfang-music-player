<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import { usePlayerStore } from '@/stores/player'
import type { ThemeMode } from '@/stores/user'

const userStore = useUserStore()
const playerStore = usePlayerStore()

const themes: { value: ThemeMode; label: string }[] = [
  { value: 'dark', label: '深色' },
  { value: 'light', label: '浅色' },
  { value: 'system', label: '跟随系统' }
]

function setTheme(mode: ThemeMode) {
  userStore.setTheme(mode)
}

function clearHistory() {
  userStore.clearHistory()
}

function clearAllData() {
  if (confirm('确定清除所有本地数据？这将删除播放历史和自定义歌单。')) {
    window.localStorage.clear()
    window.location.reload()
  }
}
</script>

<template>
  <main class="settings">
    <h1 class="settings__title">设置</h1>

    <section class="settings__section">
      <h2 class="settings__section-title">主题</h2>
      <div class="settings__theme-options">
        <button
          v-for="t in themes"
          :key="t.value"
          class="settings__theme-btn"
          :class="{ 'settings__theme-btn--active': userStore.theme === t.value }"
          @click="setTheme(t.value)"
        >
          {{ t.label }}
        </button>
      </div>
    </section>

    <section class="settings__section">
      <h2 class="settings__section-title">播放</h2>
      <div class="settings__row">
        <span>音量</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="playerStore.volume"
          @input="(e) => playerStore.setVolume(parseFloat((e.target as HTMLInputElement).value))"
          class="settings__slider"
        />
        <span class="settings__vol-value">{{ Math.round(playerStore.volume * 100) }}%</span>
      </div>
    </section>

    <section class="settings__section">
      <h2 class="settings__section-title">数据</h2>
      <div class="settings__row">
        <span>播放历史 ({{ userStore.playHistory.length }} 首)</span>
        <button class="settings__btn" @click="clearHistory" :disabled="userStore.playHistory.length === 0">
          清除
        </button>
      </div>
      <div class="settings__row">
        <span>收藏歌曲 ({{ userStore.favorites.length }} 首)</span>
      </div>
      <div class="settings__row settings__row--danger">
        <span>清除所有本地数据</span>
        <button class="settings__btn settings__btn--danger" @click="clearAllData">
          清除全部
        </button>
      </div>
    </section>

    <section class="settings__section settings__section--about">
      <p class="settings__version">远方音乐 v2.0.0</p>
      <p class="settings__copyright">基于 Vue 3 + Cloudflare 构建</p>
    </section>
  </main>
</template>

<style scoped>
.settings {
  padding: var(--spacing-lg);
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

.settings__title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: var(--spacing-xl);
}

.settings__section {
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--bg-tertiary);
}

.settings__section--about {
  border-bottom: none;
  text-align: center;
}

.settings__section-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--spacing-md);
}

.settings__theme-options {
  display: flex;
  gap: var(--spacing-sm);
}

.settings__theme-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-tertiary);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all var(--transition-fast);
}

.settings__theme-btn:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.settings__theme-btn--active {
  border-color: var(--color-primary);
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) 0;
  font-size: 0.9rem;
}

.settings__row--danger {
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--bg-tertiary);
}

.settings__slider {
  flex: 1;
  max-width: 200px;
  margin: 0 var(--spacing-md);
  accent-color: var(--color-primary);
}

.settings__vol-value {
  font-size: 0.8rem;
  color: var(--text-secondary);
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.settings__btn {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--bg-tertiary);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
}

.settings__btn:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.settings__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.settings__btn--danger {
  color: #e74c3c;
  border: 1px solid #e74c3c;
  background: transparent;
}

.settings__btn--danger:hover {
  background: #e74c3c20;
}

.settings__version {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.settings__copyright {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: var(--spacing-xs);
}
</style>
