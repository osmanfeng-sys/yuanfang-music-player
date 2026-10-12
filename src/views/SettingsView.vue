<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { usePlayerStore } from '@/stores/player'
import {
  loadCredentials,
  saveCredentials,
  clearCredentials,
  deriveUserKey
} from '@/utils/userKey'

const userStore = useUserStore()
const playerStore = usePlayerStore()
const router = useRouter()

/** 关闭设置：能回退就回退，直接打开 /settings 时没有上一条历史，退回首页 */
function closeSettings() {
  if (window.history.state?.back) router.back()
  else router.push('/')
}

/** 歌单同步：ID + 密码派生出的 key 决定云端歌单归属 */
const MIN_PASS = 8
const syncId = ref('')
const syncPass = ref('')
/** 已生效凭据的短指纹 —— 用来在两台设备上核对是不是同一个身份 */
const fingerprint = ref('')
const syncError = ref('')

onMounted(async () => {
  const c = loadCredentials()
  if (!c) return
  syncId.value = c.id
  syncPass.value = c.pass
  fingerprint.value = await deriveUserKey(c.id, c.pass).catch(() => '')
})

async function saveSync() {
  const id = syncId.value.trim()
  const pass = syncPass.value
  syncError.value = ''

  if (!id) {
    syncError.value = '请填写用户 ID'
    return
  }
  if (pass.length < MIN_PASS) {
    syncError.value = `密码至少 ${MIN_PASS} 位`
    return
  }

  try {
    fingerprint.value = await deriveUserKey(id, pass)
  } catch {
    syncError.value = '当前环境不支持加密，请用 HTTPS 或 localhost 打开'
    return
  }
  saveCredentials(id, pass)
}

function clearSync() {
  if (!confirm('清除歌单同步凭据？云端歌单不会被删除，只是本机不再读取它。')) return
  clearCredentials()
  syncId.value = ''
  syncPass.value = ''
  fingerprint.value = ''
  syncError.value = ''
}

function clearHistory() {
  userStore.clearHistory()
}

function clearAllData() {
  if (confirm('确定清除所有本地数据？这将删除播放历史和自定义歌单。')) {
    window.localStorage.clear()
    window.location.reload()
  }
}
</script>

<template>
  <main class="settings">
    <div class="settings__head">
      <h1 class="settings__title">设置</h1>
      <button
        class="settings__close"
        title="关闭"
        aria-label="关闭设置"
        @click="closeSettings"
      >✕</button>
    </div>

    <section class="settings__section">
      <h2 class="settings__section-title">播放</h2>
      <div class="settings__row">
        <span>音量</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="playerStore.volume"
          @input="(e) => playerStore.setVolume(parseFloat((e.target as HTMLInputElement).value))"
          class="settings__slider"
        />
        <span class="settings__vol-value">{{ Math.round(playerStore.volume * 100) }}%</span>
      </div>
    </section>

    <section class="settings__section">
      <h2 class="settings__section-title">歌单同步</h2>
      <p class="settings__hint">
        设一组「用户 ID + 密码」，歌单就会存到云端并归属这个身份；换设备输入同样的
        ID 和密码即可取回。<br />
        这是自定义口令，不是账号 —— <b>别用你在其它网站的密码</b>。
      </p>

      <label class="settings__field">
        <span>用户 ID</span>
        <input v-model="syncId" class="settings__input" placeholder="随便起，例如 osman" />
      </label>

      <label class="settings__field">
        <span>密码</span>
        <input
          v-model="syncPass"
          type="password"
          class="settings__input"
          :placeholder="`至少 ${MIN_PASS} 位`"
        />
      </label>

      <div class="settings__row">
        <span class="settings__state">
          {{ fingerprint ? `已开启 · 指纹 ${fingerprint.slice(0, 8)}` : '未设置（歌单只存本机）' }}
        </span>
        <span class="settings__actions">
          <button class="settings__btn" @click="saveSync">保存</button>
          <button
            class="settings__btn settings__btn--danger"
            :disabled="!fingerprint"
            @click="clearSync"
          >
            清除
          </button>
        </span>
      </div>

      <p v-if="syncError" class="settings__error">{{ syncError }}</p>
    </section>

    <section class="settings__section">
      <h2 class="settings__section-title">数据</h2>
      <div class="settings__row">
        <span>播放历史 ({{ userStore.playHistory.length }} 首)</span>
        <button class="settings__btn" @click="clearHistory" :disabled="userStore.playHistory.length === 0">
          清除
        </button>
      </div>
      <div class="settings__row">
        <span>收藏歌曲 ({{ userStore.favorites.length }} 首)</span>
      </div>
      <div class="settings__row settings__row--danger">
        <span>清除所有本地数据</span>
        <button class="settings__btn settings__btn--danger" @click="clearAllData">
          清除全部
        </button>
      </div>
    </section>

    <section class="settings__section settings__section--about">
      <p class="settings__version">远方音乐 v2.0.0</p>
      <p class="settings__copyright">基于 Vue 3 + Cloudflare 构建</p>
    </section>
  </main>
</template>

<style scoped>
.settings {
  height: 100%;
  overflow-y: auto;
  padding: var(--spacing-lg);
  max-width: 700px;
  margin: 0 auto;
  width: 100%;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-radius);
}

/* 标题行：标题靠左，关闭按钮靠右 */
.settings__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl);
}

.settings__title {
  font-size: 1.5rem;
  font-weight: 700;
}

.settings__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  font-size: 14px;
  line-height: 1;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.settings__close:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.settings__section {
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--bg-tertiary);
}

.settings__section--about {
  border-bottom: none;
  text-align: center;
}

.settings__section-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--spacing-md);
}

/* ===== 歌单同步 ===== */
.settings__hint {
  font-size: 0.8rem;
  line-height: 1.7;
  color: var(--text-tertiary);
  margin-bottom: var(--spacing-md);
}

.settings__field {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xs) 0;
  font-size: 0.9rem;
}

.settings__field > span {
  width: 72px;
  flex-shrink: 0;
  color: var(--text-secondary);
}

.settings__input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  font-size: 0.85rem;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  outline: none;
}

.settings__input:focus {
  border-color: var(--color-primary);
}

.settings__state {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.settings__actions {
  display: flex;
  gap: var(--spacing-sm);
}

.settings__error {
  margin-top: var(--spacing-sm);
  font-size: 0.8rem;
  color: #e74c3c;
}

.settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) 0;
  font-size: 0.9rem;
}

.settings__row--danger {
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--bg-tertiary);
}

.settings__slider {
  flex: 1;
  max-width: 200px;
  margin: 0 var(--spacing-md);
  accent-color: var(--color-primary);
}

.settings__vol-value {
  font-size: 0.8rem;
  color: var(--text-secondary);
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.settings__btn {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--bg-tertiary);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
}

.settings__btn:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.settings__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.settings__btn--danger {
  color: #e74c3c;
  border: 1px solid #e74c3c;
  background: transparent;
}

.settings__btn--danger:hover {
  background: #e74c3c20;
}

.settings__version {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.settings__copyright {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: var(--spacing-xs);
}
</style>
