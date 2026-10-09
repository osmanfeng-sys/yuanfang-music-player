<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { formatTime } from '@/utils/format'
import MusicPlayer from '@/components/player/MusicPlayer.vue'
import type { PlayMode } from '@/types'

const playerStore = usePlayerStore()

/** 播放模式循环顺序：列表循环 → 单曲循环 → 随机 */
const MODES: { key: PlayMode; label: string }[] = [
  { key: 'list-repeat', label: '列表循环' },
  { key: 'single-repeat', label: '单曲循环' },
  { key: 'shuffle', label: '随机播放' }
]

const modeIndex = computed(() => {
  const i = MODES.findIndex((m) => m.key === playerStore.playMode)
  return i === -1 ? 0 : i
})

const modeLabel = computed(() => MODES[modeIndex.value].label)

function cycleMode() {
  playerStore.setPlayMode(MODES[(modeIndex.value + 1) % MODES.length].key)
}

/** 进度条拖拽状态 */
const barRef = ref<HTMLElement>()
const isDragging = ref(false)
const isHovering = ref(false)

/** 当前音量百分比（静音时显示为 0） */
const volPct = computed(() =>
  Math.round((playerStore.muted ? 0 : playerStore.volume) * 100)
)

/** 音量条：用原生 range，拖动/键盘都给，不用手写拖拽 */
function onVolumeInput(e: Event) {
  if (playerStore.muted) playerStore.toggleMute()
  playerStore.setVolume(Number((e.target as HTMLInputElement).value) / 100)
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

    <!-- 极简通栏：[曲目] [上一首/播放/下一首] [====进度====] [音量] -->
    <template v-else>
      <div class="footer__track-info">
        <div class="footer__cover">
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>

        <button class="footer__btn footer__btn--play" @click="playerStore.togglePlay()" aria-label="播放/暂停">
          <svg v-if="playerStore.isPlaying" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>

        <button class="footer__btn" @click="playerStore.next()" aria-label="下一首">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 6h2v12h-2zm-3.5 6l-8.5 6V6z" />
          </svg>
        </button>

        <button
          class="footer__btn footer__btn--on"
          :title="modeLabel"
          :aria-label="modeLabel"
          @click="cycleMode"
        >
          <!-- 单曲循环：循环箭头 + 1 -->
          <svg v-if="playerStore.playMode === 'single-repeat'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 2l4 4-4 4" />
            <path d="M3 11v-1a4 4 0 014-4h14" />
            <path d="M7 22l-4-4 4-4" />
            <path d="M21 13v1a4 4 0 01-4 4H3" />
            <path d="M11 10.5L12.5 10v4" />
          </svg>
          <!-- 随机 -->
          <svg v-else-if="playerStore.playMode === 'shuffle'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" />
            <line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
          </svg>
          <!-- 列表循环 -->
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 2l4 4-4 4" />
            <path d="M3 11v-1a4 4 0 014-4h14" />
            <path d="M7 22l-4-4 4-4" />
            <path d="M21 13v1a4 4 0 01-4 4H3" />
          </svg>
        </button>
      </div>

      <!-- 进度：时间戳夹在进度条两侧（对齐参考站） -->
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

      <!-- 音量：常显横向条，点图标静音 -->
      <div class="footer__volume">
        <button
          class="footer__btn"
          :aria-label="playerStore.muted ? '取消静音' : '静音'"
          @click="playerStore.toggleMute()"
        >
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

        <input
          class="footer__vol-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          :value="volPct"
          aria-label="音量"
          :style="{
            background: `linear-gradient(to right, var(--accent) ${volPct}%, rgba(255,255,255,0.15) ${volPct}%)`
          }"
          @input="onVolumeInput"
        />
      </div>
    </template>
  </footer>
</template>

<style scoped>
.footer {
  position: fixed;
  bottom: 12px;
  left: var(--page-gutter);
  right: var(--page-gutter);
  height: var(--playerbar-height);
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  padding: 0 var(--spacing-lg);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-radius);
  box-shadow: var(--shadow-lg);
  z-index: 100;
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

/* ===== 左：曲目 ===== */
.footer__track-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 200px;
  min-width: 0;
  flex-shrink: 0;
}

.footer__cover {
  display: flex;
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
}

.footer__artist {
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ===== 中：播放控制（图标紧凑均距） ===== */
.footer__controls {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.footer__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-full);
  transition: all var(--transition-fast);
}

.footer__btn:hover {
  color: var(--text-primary);
  transform: scale(1.08);
}

/* 播放模式按钮：常亮强调色，一眼看出当前模式 */
.footer__btn--on {
  color: var(--accent);
}

.footer__btn--play {
  width: 38px;
  height: 38px;
  margin: 0 4px;
  background: var(--accent);
  color: #fff;
  box-shadow: 0 2px 10px rgba(255, 94, 94, 0.45);
}

.footer__btn--play:hover {
  background: #ff7676;
  transform: none;
}

/* ===== 中：进度（时间戳贴条两端） ===== */
.footer__progress {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.footer__time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
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
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  position: relative;
  cursor: pointer;
}

.footer__bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
  transition: width 0.1s linear;
}

.footer__bar-thumb {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  transform: translate(-50%, -50%) scale(0);
  transition: transform 0.15s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.footer__bar-thumb--active {
  transform: translate(-50%, -50%) scale(1);
}

/* ===== 右：音量（常显横向，不再弹层） ===== */
.footer__volume {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 124px;
  flex-shrink: 0;
}

.footer__vol-slider {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  height: 4px;
  border-radius: 4px;
  outline: none;
  cursor: pointer;
}

.footer__vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.footer__vol-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: none;
  border-radius: 50%;
  background: #fff;
}

.footer__empty {
  width: 100%;
  display: flex;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

/* ===== 移动端：收起进度，保留曲目 / 控制 / 音量 ===== */
@media (max-width: 767px) {
  .footer {
    gap: var(--spacing-sm);
    padding: 0 var(--spacing-md);
  }
  .footer__progress {
    display: none;
  }
  .footer__track-info {
    flex: 1;
    width: auto;
  }
}

@media (max-width: 479px) {
  .footer__volume {
    width: auto;
  }
  .footer__vol-slider {
    display: none;
  }
}
</style>
