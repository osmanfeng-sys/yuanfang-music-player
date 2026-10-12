<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'
import { formatTime } from '@/utils/format'
import type { Track } from '@/types'

/**
 * 「从曲库添加」——一级是音乐夹，点进去是该夹曲目，勾选多首一次加入。
 *
 * 取代了原来的「搜索 + 单首点加」：那样一次只能加一首，而且得先知道歌名。
 * 按音乐夹挑更符合「把这张专辑整张加进去」的实际用法。
 */
const props = defineProps<{
  open: boolean
  /** 已在歌单里的曲目 id —— 置灰不可选，从根上避免重复添加 */
  excludeIds: string[]
}>()

const emit = defineEmits<{
  close: []
  confirm: [trackIds: string[]]
}>()

const playlistStore = usePlaylistStore()

/** null = 一级（音乐夹列表）；否则是当前打开的音乐夹名 */
const openedFolder = ref<string | null>(null)
const selected = ref<string[]>([])

const folders = computed(() => playlistStore.folders)

const currentTracks = computed<Track[]>(() =>
  openedFolder.value
    ? (folders.value.find((f) => f.name === openedFolder.value)?.tracks ?? [])
    : []
)

// 每次打开都回到一级、清空勾选，别留着上次的痕迹
watch(
  () => props.open,
  (v) => {
    if (v) {
      openedFolder.value = null
      selected.value = []
    }
  }
)

function selectable(t: Track) {
  return !props.excludeIds.includes(t.id)
}

function toggle(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((x) => x !== id)
    : [...selected.value, id]
}

/** 全选只覆盖「本夹里还没在歌单中的」 */
const allPicked = computed(() => {
  const can = currentTracks.value.filter(selectable)
  return can.length > 0 && can.every((t) => selected.value.includes(t.id))
})

function toggleAll() {
  const ids = currentTracks.value.map((t) => t.id)
  if (allPicked.value) {
    selected.value = selected.value.filter((id) => !ids.includes(id))
  } else {
    selected.value = Array.from(
      new Set([...selected.value, ...currentTracks.value.filter(selectable).map((t) => t.id)])
    )
  }
}
</script>

<template>
  <div v-if="open" class="at-modal" @click.self="emit('close')">
    <div class="at-modal__panel">
      <div class="at-modal__head">
        <button v-if="openedFolder" class="at-modal__back" @click="openedFolder = null">
          ‹ 音乐夹
        </button>
        <span v-else class="at-modal__title">从曲库添加</span>
        <button class="at-modal__x" aria-label="关闭" @click="emit('close')">✕</button>
      </div>

      <!-- 一级：音乐夹 -->
      <ul v-if="!openedFolder" class="at-modal__list">
        <li v-for="f in folders" :key="f.name">
          <button class="at-modal__row" @click="openedFolder = f.name">
            <span class="at-modal__name">{{ f.name }}</span>
            <span class="at-modal__meta">{{ f.tracks.length }} 首 ›</span>
          </button>
        </li>
      </ul>

      <!-- 二级：该夹曲目，可多选 -->
      <template v-else>
        <button class="at-modal__all" @click="toggleAll">
          {{ allPicked ? '取消全选' : '全选（只选未加入的）' }}
        </button>
        <ul class="at-modal__list">
          <li v-for="t in currentTracks" :key="t.id">
            <button
              class="at-modal__row at-modal__row--track"
              :class="{ 'at-modal__row--on': selected.includes(t.id) }"
              :disabled="!selectable(t)"
              @click="toggle(t.id)"
            >
              <span class="at-modal__box">
                {{ selectable(t) ? (selected.includes(t.id) ? '☑' : '☐') : '✓' }}
              </span>
              <span class="at-modal__name">{{ t.title }}</span>
              <span class="at-modal__artist">{{ t.artist }}</span>
              <span class="at-modal__meta">
                {{ t.duration ? formatTime(t.duration) : '--:--' }}
              </span>
            </button>
          </li>
        </ul>
      </template>

      <div class="at-modal__foot">
        <span class="at-modal__sel">已选 {{ selected.length }} 首</span>
        <button
          class="at-modal__ok"
          :disabled="selected.length === 0"
          @click="emit('confirm', selected)"
        >
          加入歌单
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.at-modal {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}

.at-modal__panel {
  width: min(520px, 92vw);
  height: min(560px, 78vh);
  display: flex;
  flex-direction: column;
  background: rgba(20, 20, 20, 0.94);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-radius);
  overflow: hidden;
}

.at-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px var(--spacing-md);
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid var(--glass-border);
}

.at-modal__back,
.at-modal__x {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.at-modal__x {
  width: 26px;
  padding: 0;
}

.at-modal__back:hover,
.at-modal__x:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.at-modal__all {
  margin: 6px 8px 0;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
}

.at-modal__all:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.at-modal__list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.at-modal__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: 9px 10px;
  font-size: 13px;
  color: var(--text-primary);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
}

.at-modal__row:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.at-modal__row--on {
  color: var(--color-primary);
}

.at-modal__row:disabled {
  color: var(--text-faint);
  cursor: default;
}

.at-modal__box {
  flex-shrink: 0;
  width: 16px;
  text-align: center;
  color: var(--text-secondary);
}

.at-modal__name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.at-modal__artist {
  width: 110px;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.at-modal__meta {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.at-modal__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: 10px var(--spacing-md);
  border-top: 1px solid var(--glass-border);
}

.at-modal__sel {
  font-size: 12px;
  color: var(--text-secondary);
}

.at-modal__ok {
  padding: 7px 18px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
}

.at-modal__ok:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.at-modal__ok:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

@media (max-width: 639px) {
  .at-modal__artist {
    display: none;
  }
}
</style>
