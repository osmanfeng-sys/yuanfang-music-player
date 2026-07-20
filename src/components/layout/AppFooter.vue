<script setup lang="ts">
import { usePlayerStore } from '@/stores/player'
import { formatTime } from '@/utils/format'
import MusicPlayer from '@/components/player/MusicPlayer.vue'

const playerStore = usePlayerStore()

/** 点击进度条跳转 */
function onProgressClick(e: MouseEvent) {
  const bar = e.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const ratio = (e.clientX - rect.left) / rect.width
  playerStore.seek(ratio * playerStore.duration)
}
</script>

<template>
  <footer class="footer">
    <!-- MusicPlayer 实际初始化 APlayer（始终挂载，隐藏，只用作音频引擎） -->
    <div class="footer__engine" v-show="playerStore.queue.length > 0">
      <MusicPlayer />
    </div>

    <!-- 空状态 -->
    <template v-if="!playerStore.currentTrack">
      <div class="footer__empty">
        <p>选择一首歌曲开始播放</p>
      </div>
    </template>

    <!-- 迷你播放条 -->
    <template v-else>
      <div class="footer__track-info">
        <div class="footer__cover">
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="4" fill="var(--bg-tertiary)" />
            <path d="M11 22V10l12 6-12 6z" fill="var(--color-primary)" opacity="0.6" />
          </svg>
        </div>
        <div class="footer__text">
          <p class="footer__title">{{ playerStore.currentTrack.title }}</p>
          <p class="footer__artist">{{ playerStore.currentTrack.artist }}</p>
        </div>
      </div>

      <div class="footer__controls">
        <button class="footer__btn" @click="playerStore.prev()" aria-label="上一首">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>

        <button class="footer__btn footer__btn--play" @click="playerStore.togglePlay()" aria-label="播放/暂停">
          <svg v-if="playerStore.isPlaying" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>

        <button class="footer__btn" @click="playerStore.next()" aria-label="下一首">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 6h2v12h-2zm-3.5 6l-8.5 6V6z" />
          </svg>
        </button>
      </div>

      <div class="footer__progress" @click="onProgressClick">
        <span class="footer__time">{{ formatTime(playerStore.currentTime) }}</span>
        <div class="footer__bar">
          <div class="footer__bar-track">
            <div class="footer__bar-fill" :style="{ width: `${playerStore.progress * 100}%` }" />
          </div>
        </div>
        <span class="footer__time">{{ formatTime(playerStore.duration) }}</span>
      </div>
    </template>
  </footer>
</template>

<style scoped>
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--footer-height);
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-md);
  background: var(--bg-secondary);
  border-top: 1px solid var(--bg-tertiary);
  z-index: 100;
  gap: var(--spacing-md);
}

/* MusicPlayer 容器 — 隐藏，只用作音频引擎 */
.footer__engine {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.footer__track-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
  flex-shrink: 0;
}

.footer__cover {
  flex-shrink: 0;
}

.footer__text {
  min-width: 0;
}

.footer__title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.footer__artist {
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.footer__controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.footer__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-full);
  transition: all var(--transition-fast);
}

.footer__btn:hover {
  color: var(--text-primary);
}

.footer__btn--play {
  width: 40px;
  height: 40px;
  background: var(--color-primary);
  color: #fff;
}

.footer__btn--play:hover {
  background: var(--color-primary-hover);
}

.footer__progress {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.footer__time {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.footer__bar {
  flex: 1;
  display: flex;
  align-items: center;
}

.footer__bar-track {
  width: 100%;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.footer__bar-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
  transition: width 0.1s linear;
}

.footer__empty {
  width: 100%;
  display: flex;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

/* 移动端适配 */
@media (max-width: 639px) {
  .footer {
    gap: var(--spacing-sm);
  }
  .footer__track-info {
    flex: 1;
    min-width: 0;
  }
  .footer__progress {
    display: none;
  }
}
</style>
