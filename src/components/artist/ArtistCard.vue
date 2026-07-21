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
      <!-- 默认头像：渐变背景 + 音符图标 -->
      <svg width="100%" height="100%" viewBox="0 0 120 120" fill="none">
        <defs>
          <linearGradient id="abg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1DB954"/>
            <stop offset="100%" stop-color="#148a3c"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="16" fill="url(#abg)"/>
        <circle cx="60" cy="52" r="16" fill="rgba(255,255,255,0.2)"/>
        <path d="M42 86c0-10 8-18 18-18s18 8 18 18" stroke="rgba(255,255,255,0.4)" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M57 42l18-5v18M57 55l18-5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/>
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
