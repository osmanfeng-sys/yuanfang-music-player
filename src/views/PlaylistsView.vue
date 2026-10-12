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

async function onCreate() {
  const name = window.prompt('歌单名称')
  if (!name?.trim()) return
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
    <!-- 状态行：不重复渲染标题，标题和「新建」由 MyPlaylists 自己提供 -->
    <p class="playlists__status" :class="{ 'playlists__status--cloud': cloudOn }">
      {{ cloudOn ? '云端同步已开启' : '歌单只存在本机' }}
      <router-link to="/settings" class="playlists__status-link">
        {{ cloudOn ? '更改' : '去设置开启同步' }}
      </router-link>
    </p>

    <p v-if="playlistStore.error" class="playlists__error">{{ playlistStore.error }}</p>

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

.playlists__status {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0 var(--spacing-lg) var(--spacing-sm);
  font-size: 0.8rem;
  color: var(--text-tertiary);
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
  padding: 0 var(--spacing-lg) var(--spacing-sm);
  font-size: 0.8rem;
  color: #e74c3c;
}
</style>
