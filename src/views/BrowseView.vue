<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'
import ArtistList from '@/components/artist/ArtistList.vue'
import { fetchArtists } from '@/services/music'
import type { Artist } from '@/types'

const playlistStore = usePlaylistStore()
const artists = ref<Artist[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    // 先尝试从 store 缓存拿
    if (playlistStore.artistCache.length > 0) {
      artists.value = playlistStore.artistCache
    } else {
      artists.value = await fetchArtists()
      playlistStore.artistCache = artists.value
    }
  } catch {
    // 错误时静默，ArtistList 显示空状态
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="browse">
    <h1 class="browse__title">浏览音乐</h1>
    <ArtistList :artists="artists" :loading="loading" />
  </main>
</template>

<style scoped>
.browse {
  padding: var(--spacing-lg);
  max-width: var(--content-max-width);
  margin: 0 auto;
  width: 100%;
}

.browse__title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: var(--spacing-lg);
}
</style>
