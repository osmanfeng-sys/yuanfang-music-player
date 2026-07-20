<script setup lang="ts">
defineProps<{
  size?: 'sm' | 'md' | 'lg'
  text?: string
}>()
</script>

<template>
  <div class="spinner" :class="`spinner--${size || 'md'}`">
    <div class="spinner__ring" />
    <p v-if="text" class="spinner__text">{{ text }}</p>
  </div>
</template>

<style scoped>
.spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
}

.spinner__ring {
  border: 3px solid var(--bg-tertiary);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner--sm .spinner__ring { width: 20px; height: 20px; }
.spinner--md .spinner__ring { width: 36px; height: 36px; border-width: 4px; }
.spinner--lg .spinner__ring { width: 48px; height: 48px; border-width: 5px; }

.spinner__text {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
