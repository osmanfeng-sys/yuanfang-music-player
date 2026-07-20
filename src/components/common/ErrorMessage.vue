<script setup lang="ts">
defineProps<{
  message: string
  retryable?: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="error">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
      <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <p class="error__message">{{ message }}</p>
    <button v-if="retryable" class="error__retry" @click="emit('retry')">
      重试
    </button>
  </div>
</template>

<style scoped>
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl);
  color: var(--text-secondary);
}

.error__message {
  font-size: 0.9rem;
  text-align: center;
  max-width: 320px;
}

.error__retry {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  font-size: 0.85rem;
  transition: background var(--transition-fast);
}

.error__retry:hover {
  background: var(--color-primary-hover);
}
</style>
