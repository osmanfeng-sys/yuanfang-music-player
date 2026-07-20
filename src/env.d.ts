/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'aplayer' {
  import APlayer from 'aplayer'
  export default APlayer
}

// aplayer 无官方类型定义，使用 any 声明
interface APlayer {
  play(): void
  pause(): void
  seek(time: number): void
  volume(vol: number): void
  destroy(): void
  mode(mode: string): void
  list: {
    clear(): void
    add(audios: any[]): void
    switch(index: number): void
  }
  on(event: string, handler: (...args: any[]) => void): void
  audio: HTMLAudioElement
  order: string
}

interface APlayerAudio {
  name: string
  artist: string
  url: string
  cover?: string
  lrc?: string
}
