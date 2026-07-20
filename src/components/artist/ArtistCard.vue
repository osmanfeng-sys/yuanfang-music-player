<script setup lang="ts">
import type { Artist } from '@/types'
import { useRouter } from 'vue-router'

const props = defineProps<{
  artist: Artist
}>()

const emit = defineEmits<{
  click: [artistId: string]
  'play-all': [artistId: string]
}>()

const router = useRouter()

function onClick() {
  router.push(`/artist/${props.artist.id}`)
  emit('click', props.artist.id)
}
</script>

<template>
  <div class="artist-card" @click="onClick" role="button" tabindex="0" @keydown.enter="onClick">
    <div class="artist-card__cover">
      <svg width="100%" height="100%" viewBox="0 0 64 64" fill="none">
        <rect width="64" height="64" rx="12" fill="var(--bg-tertiary)" />
        <circle cx="32" cy="28" r="10" fill="var(--bg-elevated)" />
        <path d="M22 48c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="var(--bg-elevated)" stroke-width="3" fill="none" />
      </svg>
    </div>
    <div class="artist-card__info">
      <p class="artist-card__name">{{ artist.name }}</p>
      <p class="artist-card__count">{{ artist.trackCount }} 首歌曲</p>
    </div>
  </div>
</template>

<style scoped>
.artist-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.artist-card:hover {
  background: var(--bg-tertiary);
}

.artist-card__cover {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-md);
}

.artist-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.artist-card__name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.artist-card__count {
  font-size: 0.8rem;
  color: var(--text-secondary);
}
</style>
