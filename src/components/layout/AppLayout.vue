<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useUserStore } from '@/stores/user'
import AppHeader from './AppHeader.vue'
import AppFooter from './AppFooter.vue'

const playerStore = usePlayerStore()
const userStore = useUserStore()

/** 背景图池（与参考站一致：每小时固定一张随机图） */
const BG_IMAGES = Array.from({ length: 7 }, (_, i) => `/bg/${i}.webp`)

function pickWallpaper(): string {
  const key = 'ym:bgIndex_' + new Date().getHours()
  try {
    const saved = Number(localStorage.getItem(key))
    if (Number.isInteger(saved) && saved >= 0 && saved < BG_IMAGES.length) {
      return BG_IMAGES[saved]
    }
    const idx = Math.floor(Math.random() * BG_IMAGES.length)
    localStorage.setItem(key, String(idx))
    return BG_IMAGES[idx]
  } catch {
    return BG_IMAGES[0]
  }
}

const wallpaperUrl = ref(pickWallpaper())

/** 当前封面（用于 "封面模糊" 背景模式） */
const coverUrl = computed(() => playerStore.currentTrack?.cover || '')
const showWallpaper = computed(() => userStore.bgMode === 'wallpaper' || !coverUrl.value)
const showCover = computed(() => userStore.bgMode === 'cover' && !!coverUrl.value)
</script>

<template>
  <div class="layout">
    <!-- 背景层：壁纸（铺满，与参考站一致） -->
    <div
      v-show="showWallpaper"
      class="layout__bg"
      :style="{ backgroundImage: `url('${wallpaperUrl}')` }"
    />
    <!-- 背景层：当前封面放大模糊 -->
    <div
      v-show="showCover"
      class="layout__bg-cover"
      :style="{ backgroundImage: `url('${coverUrl}')` }"
    />
    <div class="layout__scrim" />

    <AppHeader />

    <main class="layout__content">
      <router-view />
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* 满屏不滚动，所有面板悬浮在背景之上 */
.layout {
  position: fixed;
  inset: 0;
  overflow: hidden;
}

.layout__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-color: #000;
  background-position: center center;
  background-size: cover;
  background-repeat: no-repeat;
}

.layout__bg-cover {
  position: absolute;
  inset: -12%;
  z-index: 0;
  background-color: #000;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  filter: blur(60px) brightness(0.55) saturate(1.3);
}

.layout__scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(0, 0, 0, 0.35);
}

/* 内容区：顶栏与底栏之间 */
.layout__content {
  position: absolute;
  top: calc(var(--topbar-height) + 8px);
  left: var(--page-gutter);
  right: var(--page-gutter);
  bottom: calc(var(--playerbar-height) + 12px);
  z-index: 2;
  overflow: hidden;
}
</style>
