<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSearchStore } from '@/stores/search'
import { usePlaylistStore } from '@/stores/playlist'
import { usePlayerStore } from '@/stores/player'
import SearchBar from '@/components/search/SearchBar.vue'
import SearchResults from '@/components/search/SearchResults.vue'

const route = useRoute()
const searchStore = useSearchStore()
const playlistStore = usePlaylistStore()
const playerStore = usePlayerStore()

// 监听 URL query 变化
watch(
  () => route.query.q,
  (q) => {
    if (q && typeof q === 'string') {
      searchStore.search(q, playlistStore.trackCache)
    }
  }
)

// 初始搜索
const initialQuery = route.query.q as string | undefined
if (initialQuery) {
  searchStore.search(initialQuery, playlistStore.trackCache)
}

function playTrack(trackId: string) {
  const track = playlistStore.getTrackById(trackId)
  if (track) {
    playerStore.setQueue([track], 0)
    playerStore.isPlaying = true
  }
}

function addToQueue(trackId: string) {
  const track = playlistStore.getTrackById(trackId)
  if (track) {
    playerStore.addToQueue([track])
  }
}
</script>

<template>
  <main class="search-page">
    <h1 class="search-page__title">搜索</h1>

    <div class="search-page__bar">
      <SearchBar />
    </div>

    <SearchResults
      :results="searchStore.results"
      :loading="searchStore.isSearching"
      :query="searchStore.query"
      @play="playTrack"
      @add-to-queue="addToQueue"
    />
  </main>
</template>

<style scoped>
.search-page {
  padding: var(--spacing-lg);
  max-width: var(--content-max-width);
  margin: 0 auto;
  width: 100%;
}

.search-page__title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: var(--spacing-md);
}

.search-page__bar {
  margin-bottom: var(--spacing-lg);
}
</style>
