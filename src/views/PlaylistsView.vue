<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaylistStore } from '@/stores/playlist'
import { loadCredentials } from '@/utils/userKey'
import MyPlaylists from '@/components/playlist/MyPlaylists.vue'

const router = useRouter()
const playlistStore = usePlaylistStore()

const playlists = computed(() => playlistStore.userPlaylists)

/** 有凭据 = 走云端；没有 = 只存本机（功能照常可用） */
const cloudOn = loadCredentials() !== null

onMounted(() => {
  void playlistStore.loadUserPlaylists()
})

function onSelect(id: string) {
  router.push(`/playlist/${id}`)
}

/** 关闭：能回退就回退，直接打开 /playlists 时没有上一条历史，退回首页 */
function closeView() {
  if (window.history.state?.back) router.back()
  else router.push('/')
}

async function onCreate(name: string) {
  const created = await playlistStore.createPlaylist(name)
  if (created) router.push(`/playlist/${created.id}`)
}

async function onDelete(id: string) {
  const playlist = playlistStore.getPlaylistById(id)
  if (!playlist) return
  if (!window.confirm(`删除歌单「${playlist.name}」？此操作不可撤销。`)) return
  await playlistStore.deletePlaylist(id)
}

async function onRename(id: string, name: string) {
  await playlistStore.updatePlaylist(id, { name })
}
</script>

<template>
  <main class="playlists">
    <!-- 状态行 + 关闭按钮。标题和「新建」由 MyPlaylists 自己提供，这里不重复渲染 -->
    <div class="playlists__bar">
      <p class="playlists__status" :class="{ 'playlists__status--cloud': cloudOn }">
        {{ cloudOn ? '云端同步已开启' : '歌单只存在本机' }}
        <router-link to="/settings" class="playlists__status-link">
          {{ cloudOn ? '更改' : '去设置开启同步' }}
        </router-link>
      </p>
      <button class="playlists__close" title="关闭" aria-label="关闭" @click="closeView">
        ✕
      </button>
    </div>

    <!-- 失败信息做成显眼横幅：歌单功能出问题时最常见的原因就是云端接口不可达，
         原来只是一行灰色小字，很容易没看见就当成"点了没反应" -->
    <p v-if="playlistStore.error" class="playlists__error">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      <span>{{ playlistStore.error }}</span>
    </p>

    <MyPlaylists
      :playlists="playlists"
      @select="onSelect"
      @create="onCreate"
      @delete="onDelete"
      @rename="onRename"
    />
  </main>
</template>

<style scoped>
.playlists {
  height: 100%;
  overflow-y: auto;
  /* 左右不留 padding：让 MyPlaylists 自己的 header 分隔线能通栏 */
  padding: var(--spacing-lg) 0 0;
  width: 100%;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-radius);
}

.playlists__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: 0 var(--spacing-lg) var(--spacing-sm);
}

.playlists__status {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

.playlists__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  font-size: 13px;
  line-height: 1;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.playlists__close:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.playlists__status--cloud {
  color: var(--color-primary);
}

.playlists__status-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  opacity: 0.8;
}

.playlists__status-link:hover {
  opacity: 1;
}

.playlists__error {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  margin: 0 var(--spacing-lg) var(--spacing-md);
  padding: 10px 12px;
  font-size: 0.8rem;
  line-height: 1.6;
  color: #ffb4b4;
  background: rgba(231, 76, 60, 0.15);
  border: 1px solid rgba(231, 76, 60, 0.5);
  border-radius: var(--radius-md);
}

.playlists__error svg {
  flex-shrink: 0;
  margin-top: 2px;
}
</style>
