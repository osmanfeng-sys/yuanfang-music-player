<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
  actionText?: string
}>()

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <div class="empty">
    <svg v-if="icon === 'music'" width="48" height="48" viewBox="0 0 24 24" fill="none" opacity="0.3">
      <path d="M9 18V5l12-2v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="2" />
      <circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="2" />
    </svg>
    <svg v-else-if="icon === 'search'" width="48" height="48" viewBox="0 0 24 24" fill="none" opacity="0.3">
      <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
      <path d="M16.5 16.5l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <svg v-else-if="icon === 'playlist'" width="48" height="48" viewBox="0 0 24 24" fill="none" opacity="0.3">
      <path d="M8 6h13M8 12h13M8 18h9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <circle cx="3" cy="6" r="1" fill="currentColor" />
      <circle cx="3" cy="12" r="1" fill="currentColor" />
      <circle cx="3" cy="18" r="1" fill="currentColor" />
    </svg>
    <svg v-else width="48" height="48" viewBox="0 0 24 24" fill="none" opacity="0.3">
      <path d="M12 2a10 10 0 1010 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <h3 class="empty__title">{{ title }}</h3>
    <p v-if="description" class="empty__desc">{{ description }}</p>
    <button v-if="actionText" class="empty__action" @click="emit('action')">
      {{ actionText }}
    </button>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl) var(--spacing-md);
  color: var(--text-secondary);
}

.empty__title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: var(--spacing-sm);
}

.empty__desc {
  font-size: 0.85rem;
  text-align: center;
  max-width: 280px;
}

.empty__action {
  margin-top: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: background var(--transition-fast);
}

.empty__action:hover {
  background: var(--color-primary-hover);
}
</style>
