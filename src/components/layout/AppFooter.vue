<script setup lang="ts">
import { ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { formatTime } from '@/utils/format'
import MusicPlayer from '@/components/player/MusicPlayer.vue'

const playerStore = usePlayerStore()

/** 进度条拖拽状态 */
const barRef = ref<HTMLElement>()
const isDragging = ref(false)
const isHovering = ref(false)

/** 音量控制 */
const showVolumeSlider = ref(false)
let volumeHideTimer: ReturnType<typeof setTimeout> | null = null

function onVolumeEnter() {
  if (volumeHideTimer) clearTimeout(volumeHideTimer)
  showVolumeSlider.value = true
}

function onVolumeLeave() {
  volumeHideTimer = setTimeout(() => {
    showVolumeSlider.value = false
  }, 1200)
}

function setVolumeFromEvent(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  let ratio = 1 - (e.clientY - rect.top) / rect.height
  ratio = Math.max(0, Math.min(1, ratio))
  playerStore.setVolume(ratio)
}

/** 从鼠标事件计算并跳转进度 */
function seekFromEvent(e: MouseEvent) {
  const bar = barRef.value
  if (!bar) return
  const rect = bar.getBoundingClientRect()
  let ratio = (e.clientX - rect.left) / rect.width
  ratio = Math.max(0, Math.min(1, ratio))
  // 如果 duration 尚未加载（为 0），用 audio 元素实时获取
  let dur = playerStore.duration
  if (!dur || !isFinite(dur)) {
    const audio = document.querySelector('.footer__engine audio') as HTMLAudioElement | null
    if (audio?.duration && isFinite(audio.duration)) {
      dur = audio.duration
      playerStore.updateDuration(dur)
    }
  }
  playerStore.seek(ratio * dur)
}

function onBarMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  isDragging.value = true
  isHovering.value = true
  seekFromEvent(e)
  document.addEventListener('mousemove', onBarMouseMove)
  document.addEventListener('mouseup', onBarMouseUp)
}

function onBarMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  seekFromEvent(e)
}

function onBarMouseUp() {
  isDragging.value = false
  document.removeEventListener('mousemove', onBarMouseMove)
  document.removeEventListener('mouseup', onBarMouseUp)
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

      <div
        class="footer__progress"
        @mouseenter="isHovering = true"
        @mouseleave="isHovering = false"
      >
        <span class="footer__time">{{ formatTime(playerStore.currentTime) }}</span>
        <div class="footer__bar" ref="barRef" @mousedown="onBarMouseDown">
          <div class="footer__bar-track">
            <div class="footer__bar-fill" :style="{ width: `${playerStore.progress * 100}%` }" />
            <div
              class="footer__bar-thumb"
              :class="{ 'footer__bar-thumb--active': isDragging || isHovering }"
              :style="{ left: `${playerStore.progress * 100}%` }"
            />
          </div>
        </div>
        <span class="footer__time">{{ formatTime(playerStore.duration) }}</span>
      </div>

      <!-- 音量控制 -->
      <div
        class="footer__volume"
        @mouseenter="onVolumeEnter"
        @mouseleave="onVolumeLeave"
      >
        <button class="footer__btn footer__volume-btn" aria-label="音量">
          <svg v-if="playerStore.muted || playerStore.volume === 0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
          <svg v-else-if="playerStore.volume < 0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 010 7.07" />
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 010 7.07" />
            <path d="M19.07 4.93a10 10 0 010 14.14" />
          </svg>
        </button>

        <Transition name="vol">
          <div v-if="showVolumeSlider" class="footer__volume-slider" @mousedown.prevent>
            <div class="footer__volume-track" @mousedown="setVolumeFromEvent">
              <div
                class="footer__volume-fill"
                :style="{ height: `${playerStore.muted ? 0 : playerStore.volume * 100}%` }"
              />
            </div>
            <span class="footer__volume-pct">{{ Math.round(playerStore.muted ? 0 : playerStore.volume * 100) }}%</span>
          </div>
        </Transition>
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
  cursor: pointer;
  padding: 8px 0;
}

.footer__bar-track {
  width: 100%;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  position: relative;
  cursor: pointer;
}

.footer__bar-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
  transition: width 0.1s linear;
}

.footer__bar-thumb {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-primary);
  transform: translate(-50%, -50%) scale(0);
  transition: transform 0.15s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  pointer-events: none;
}

.footer__bar-thumb--active {
  transform: translate(-50%, -50%) scale(1);
}

/* ===== 音量控制 ===== */
.footer__volume {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.footer__volume-btn {
  width: 32px;
  height: 32px;
}

.footer__volume-slider {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-tertiary);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-xs);
  box-shadow: var(--shadow-lg);
  z-index: 200;
}

.footer__volume-track {
  position: relative;
  width: 6px;
  height: 80px;
  background: var(--bg-tertiary);
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  flex-direction: column-reverse;
}

.footer__volume-fill {
  width: 100%;
  background: var(--color-primary);
  border-radius: 3px;
  transition: height 0.1s ease;
}

.footer__volume-pct {
  font-size: 0.7rem;
  color: var(--text-secondary);
  text-align: center;
  white-space: nowrap;
}

/* 音量滑入动画 */
.vol-enter-active,
.vol-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.vol-enter-from,
.vol-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
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
  .footer__volume {
    display: none;
  }
}
</style>
