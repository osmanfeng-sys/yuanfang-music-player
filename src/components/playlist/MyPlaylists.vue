<script setup lang="ts">
import { ref, nextTick } from 'vue'
import type { Playlist } from '@/types'
import { formatRelativeTime } from '@/utils/format'
import EmptyState from '@/components/common/EmptyState.vue'

defineProps<{
  playlists: Playlist[]
}>()

const emit = defineEmits<{
  select: [playlistId: string]
  /** 带上名字 —— 命名在本组件内完成，调用方不用再弹输入框 */
  create: [name: string]
  delete: [playlistId: string]
  rename: [playlistId: string, name: string]
}>()

const editingId = ref<string | null>(null)
const editName = ref('')

function startRename(p: Playlist) {
  editingId.value = p.id
  editName.value = p.name
}

function confirmRename() {
  if (editingId.value && editName.value.trim()) {
    emit('rename', editingId.value, editName.value.trim())
  }
  editingId.value = null
}

/**
 * 新建走行内输入，不用 window.prompt()。
 *
 * prompt 会被浏览器拦截或静音（Chrome 的「阻止此页面创建更多对话框」、
 * 各种内嵌/无痕环境），返回 null 后代码直接 return —— 表现就是
 * 「点新建毫无反应」。而且阻塞式弹窗在移动端体验也差。
 */
const creating = ref(false)
const newName = ref('')
const newNameInput = ref<HTMLInputElement>()

function startCreate() {
  creating.value = true
  newName.value = ''
  nextTick(() => newNameInput.value?.focus())
}

function confirmCreate() {
  const name = newName.value.trim()
  creating.value = false
  newName.value = ''
  if (name) emit('create', name)
}

function cancelCreate() {
  creating.value = false
  newName.value = ''
}
</script>

<template>
  <div class="my-playlists">
    <div class="my-playlists__header">
      <h3 class="my-playlists__title">我的歌单</h3>
      <button class="my-playlists__create" @click="startCreate" aria-label="创建歌单">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <span>新建</span>
      </button>
    </div>

    <EmptyState
      v-if="playlists.length === 0 && !creating"
      icon="playlist"
      title="暂无歌单"
      description="点右上角「新建」创建你的第一个歌单"
    />

    <ul v-else class="my-playlists__list">
      <!-- 新建行：行内输入，回车创建 / Esc 取消 / 失焦视同确认 -->
      <li v-if="creating" class="my-playlist-item my-playlist-item--new">
        <div class="my-playlist-item__cover">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="var(--bg-tertiary)" />
            <path d="M12 8v8M8 12h8" stroke="var(--color-primary)" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </div>
        <div class="my-playlist-item__info">
          <input
            ref="newNameInput"
            v-model="newName"
            class="my-playlist-item__edit"
            placeholder="歌单名称，回车创建"
            @keydown.enter="confirmCreate"
            @keydown.esc="cancelCreate"
            @blur="confirmCreate"
          />
        </div>
      </li>

      <li
        v-for="p in playlists"
        :key="p.id"
        class="my-playlist-item"
        @click="emit('select', p.id)"
      >
        <div class="my-playlist-item__cover">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="var(--bg-tertiary)" />
            <path d="M8 6h13M8 12h13M8 18h9" stroke="var(--text-tertiary)" stroke-width="1.5" stroke-linecap="round" />
            <circle cx="3" cy="6" r="1" fill="var(--text-tertiary)" />
            <circle cx="3" cy="12" r="1" fill="var(--text-tertiary)" />
            <circle cx="3" cy="18" r="1" fill="var(--text-tertiary)" />
          </svg>
        </div>
        <div class="my-playlist-item__info">
          <template v-if="editingId === p.id">
            <input
              v-model="editName"
              class="my-playlist-item__edit"
              @keydown.enter="confirmRename"
              @blur="confirmRename"
              @click.stop
              autofocus
            />
          </template>
          <template v-else>
            <p class="my-playlist-item__name">{{ p.name }}</p>
            <p class="my-playlist-item__meta">
              {{ p.trackIds.length }} 首 · {{ formatRelativeTime(p.updatedAt) }}
            </p>
          </template>
        </div>
        <div class="my-playlist-item__actions">
          <button
            class="my-playlist-item__btn"
            @click.stop="startRename(p)"
            aria-label="重命名"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
            </svg>
          </button>
          <button
            class="my-playlist-item__btn my-playlist-item__btn--delete"
            @click.stop="emit('delete', p.id)"
            aria-label="删除"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.my-playlists {
  display: flex;
  flex-direction: column;
}

.my-playlists__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--bg-tertiary);
}

.my-playlists__title {
  font-size: 0.9rem;
  font-weight: 600;
}

.my-playlists__create {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: none;
  border: 1px solid var(--bg-elevated);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  transition: all var(--transition-fast);
}

.my-playlists__create:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.my-playlists__list {
  display: flex;
  flex-direction: column;
}

.my-playlist-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.my-playlist-item:hover {
  background: var(--bg-tertiary);
}

.my-playlist-item__info {
  flex: 1;
  min-width: 0;
}

.my-playlist-item__name {
  font-size: 0.85rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.my-playlist-item__meta {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.my-playlist-item__edit {
  width: 100%;
  background: var(--bg-elevated);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  padding: 2px var(--spacing-xs);
  font-size: 0.85rem;
  outline: none;
}

.my-playlist-item__actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.my-playlist-item:hover .my-playlist-item__actions {
  opacity: 1;
}

.my-playlist-item__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.my-playlist-item__btn:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.my-playlist-item__btn--delete:hover {
  color: #e74c3c;
}
</style>
