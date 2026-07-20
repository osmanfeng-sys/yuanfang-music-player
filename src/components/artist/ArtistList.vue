<script setup lang="ts">
import type { Artist } from '@/types'
import ArtistCard from './ArtistCard.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'

defineProps<{
  artists: Artist[]
  loading: boolean
}>()

const emit = defineEmits<{
  select: [artistId: string]
}>()
</script>

<template>
  <div class="artist-list">
    <LoadingSpinner v-if="loading" text="加载艺人列表..." />

    <EmptyState
      v-else-if="artists.length === 0"
      icon="music"
      title="暂无艺人数据"
      description="音乐库中还没有收录任何艺人"
    />

    <div v-else class="artist-list__grid">
      <ArtistCard
        v-for="artist in artists"
        :key="artist.id"
        :artist="artist"
        @click="emit('select', artist.id)"
      />
    </div>
  </div>
</template>

<style scoped>
.artist-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--spacing-md);
}

@media (max-width: 480px) {
  .artist-list__grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-sm);
  }
}
</style>
