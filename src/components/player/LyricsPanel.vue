<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

/** 解析后的 LRC 行 */
interface LrcLine {
  time: number
  text: string
}

const props = defineProps<{
  lyrics: string | null
  currentTime: number
}>()

/** 当前高亮行的索引 */
const activeIndex = ref(-1)
/** 歌词容器 DOM 引用 */
const containerRef = ref<HTMLDivElement>()

// ===== LRC 解析 =====

/** 解析 LRC 格式文本 → 排序后的行数组 */
function parseLrc(text: string): LrcLine[] {
  const lines = text.split('\n')
  const result: LrcLine[] = []
  const tagPattern = /^\[\d{2}:\d{2}\.\d{2,3}\]/
  const timePattern = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || !tagPattern.test(trimmed)) continue

    const match = trimmed.match(timePattern)
    if (!match) continue

    const minutes = parseInt(match[1], 10)
    const seconds = parseInt(match[2], 10)
    const millis = parseInt(match[3].padEnd(3, '0'), 10)
    const time = minutes * 60 + seconds + millis / 1000

    // 提取文本：去掉时间标签后的部分
    const text = trimmed.replace(timePattern, '').trim()

    result.push({ time, text })
  }

  // 按时间排序
  result.sort((a, b) => a.time - b.time)
  return result
}

const parsedLines = computed(() => {
  if (!props.lyrics) return []
  return parseLrc(props.lyrics)
})

// ===== 高亮逻辑 =====

watch(
  () => props.currentTime,
  (time) => {
    const lines = parsedLines.value
    if (lines.length === 0) {
      activeIndex.value = -1
      return
    }

    // 找到当前时间所在的最后一行
    let index = -1
    for (let i = 0; i < lines.length; i++) {
      if (time >= lines[i].time) {
        index = i
      }
    }
    activeIndex.value = index

    // 自动滚动到高亮行
    if (index >= 0) {
      scrollToLine(index)
    }
  }
)

/** 滚动到指定行 */
function scrollToLine(index: number) {
  nextTick(() => {
    if (!containerRef.value) return
    const activeEl = containerRef.value.querySelector(`[data-index="${index}"]`)
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  })
}
</script>

<template>
  <div class="lyrics-panel" v-if="parsedLines.length > 0">
    <div ref="containerRef" class="lyrics-panel__scroll">
      <p
        v-for="(line, i) in parsedLines"
        :key="i"
        :data-index="i"
        class="lyrics-panel__line"
        :class="{ 'lyrics-panel__line--active': i === activeIndex }"
      >
        {{ line.text || '⋯' }}
      </p>
    </div>
  </div>

  <div class="lyrics-panel lyrics-panel--empty" v-else>
    <p class="lyrics-panel__hint">
      {{ props.lyrics === null ? '暂无歌词' : '歌词加载中...' }}
    </p>
  </div>
</template>

<style scoped>
.lyrics-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lyrics-panel__scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  scroll-behavior: smooth;
}

.lyrics-panel__line {
  font-size: 1.05rem;
  color: var(--text-tertiary);
  text-align: center;
  transition: all var(--transition-normal);
  line-height: 1.6;
  cursor: default;
  user-select: none;
}

.lyrics-panel__line--active {
  color: var(--text-primary);
  font-size: 1.2rem;
  font-weight: 600;
}

.lyrics-panel--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.lyrics-panel__hint {
  color: var(--text-tertiary);
  font-size: 0.9rem;
}

/* 滚动条美化 */
.lyrics-panel__scroll::-webkit-scrollbar {
  width: 4px;
}

.lyrics-panel__scroll::-webkit-scrollbar-thumb {
  background: var(--bg-elevated);
  border-radius: 2px;
}
</style>
