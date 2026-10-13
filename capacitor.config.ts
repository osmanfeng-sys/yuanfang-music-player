import type { CapacitorConfig } from '@capacitor/cli'

/**
 * 安卓壳（模式 B：直接加载线上网页）。
 *
 * 线上更新即 App 更新 —— 改完网页推上去，用户不用重新装包。
 *
 * ⚠️ url 必须用 `yuanfang-music.pages.dev`，**不要**换成自定义域
 *    `yuanfangorganics.ccwu.cc`：后者的 SNI 在国内被 GFW 概率性阻断
 *    （实测两个子域通过率都只有 12~40%），而 pages.dev 实测 100% 可达。
 *
 *    API 迁到 Pages Functions 之后，**接口和音频也都和页面同源**，
 *    所以整个 App 只需要访问这一个域名 —— 这是这个方案能成立的前提。
 */
const config: CapacitorConfig = {
  appId: 'ccwu.yuanfang.music',
  appName: '远方音乐',
  /**
   * 模式 B 下 webDir 仍然要留：它是断网 / 加载失败时的兜底页
   * （Capacitor 打包进 App 的那份 dist），同时也是 `cap sync` 的输入。
   */
  webDir: 'dist',
  server: {
    url: 'https://yuanfang-music.pages.dev',
    cleartext: false
  },
  android: {
    allowMixedContent: false
  }
}

export default config
