<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  loadCredentials,
  saveCredentials,
  clearCredentials,
  deriveUserKey
} from '@/utils/userKey'

/**
 * 账号浮层。
 *
 * 「创建 ID」和「登录」在这套模型里是同一个动作 —— 输入 ID + 密码即确定身份
 * （key = sha256("ID:密码")）。所以没凭据时面板是创建形态，有凭据时是已登录形态。
 */
const showAccount = ref(false)
const MIN_PASS = 8

const accountId = ref('')
const accountPass = ref('')
const fingerprint = ref('')
const accountError = ref('')

const loggedIn = computed(() => fingerprint.value !== '')

const accountBtn = ref<HTMLElement>()

/**
 * 点空白处 / 按 Esc 关闭浮层。
 *
 * 面板自身挂了 @click.stop，所以冒泡到这里的一定是「面板和按钮之外」的点击；
 * 但按钮必须显式排除 —— 它自己的 click 也会冒泡上来，不排除的话
 * 刚点开就被这一句关掉，表现成「按钮没反应」。
 */
function onDocumentClick(e: MouseEvent) {
  if (!showAccount.value) return
  if (accountBtn.value?.contains(e.target as Node)) return
  showAccount.value = false
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') showAccount.value = false
}

onMounted(async () => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)

  const c = loadCredentials()
  if (!c) return
  accountId.value = c.id
  accountPass.value = c.pass
  fingerprint.value = await deriveUserKey(c.id, c.pass).catch(() => '')
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})

async function submitAccount() {
  const id = accountId.value.trim()
  const pass = accountPass.value
  accountError.value = ''

  if (!id) {
    accountError.value = '请填写用户 ID'
    return
  }
  if (pass.length < MIN_PASS) {
    accountError.value = `密码至少 ${MIN_PASS} 位`
    return
  }

  try {
    fingerprint.value = await deriveUserKey(id, pass)
  } catch {
    accountError.value = '当前环境不支持加密，请用 HTTPS 或 localhost 打开'
    return
  }
  saveCredentials(id, pass)
  showAccount.value = false
}

function logout() {
  if (!window.confirm('退出登录？云端歌单不会被删除，只是本机不再读取它。')) return
  clearCredentials()
  fingerprint.value = ''
  accountId.value = ''
  accountPass.value = ''
  accountError.value = ''
  showAccount.value = false
}
</script>

<template>
  <header class="header">
    <div class="header__left">
      <router-link to="/" class="header__logo">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" fill="var(--color-primary)" />
          <path d="M11 22V10l12 6-12 6z" fill="#fff" />
        </svg>
        <span class="header__title">远方音乐</span>
        <span class="header__handle">@AI涛哥</span>
      </router-link>

      <nav class="header__nav">
        <router-link to="/" class="nav-link" :class="{ active: $route.path === '/' }">
          首页
        </router-link>
        <router-link to="/browse" class="nav-link" :class="{ active: $route.path === '/browse' }">
          浏览
        </router-link>
        <router-link to="/playlists" class="nav-link" :class="{ active: $route.path === '/playlists' }">
          歌单
        </router-link>
      </nav>
    </div>

    <span class="header__spacer" />

    <div class="header__right">
      <button
        ref="accountBtn"
        class="header__account-btn"
        :class="{ 'header__account-btn--on': loggedIn }"
        :title="loggedIn ? `已登录：${accountId}` : '登录 / 创建 ID'"
        :aria-label="loggedIn ? '账号' : '登录或创建 ID'"
        @click="showAccount = !showAccount"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" />
        </svg>
      </button>

      <router-link to="/settings" class="header__settings-btn" aria-label="设置" title="设置">
        <!-- 齿轮。原来这里画的是「圆 + 八条放射线」，那是个太阳 ——
             跟主题按钮撞了，所以两个图标看着一模一样。 -->
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 003.68 15a1.65 1.65 0 00-1.51-1H2a2 2 0 110-4h.09A1.65 1.65 0 003.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 3.68 1.65 1.65 0 0010 2.17V2a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.14.35.44.6.82.7H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </router-link>

      <!-- 账号浮层：未登录 = 创建 / 登录；已登录 = 身份 + 退出。
           点面板内部不关闭（@click.stop），点别处或按 Esc 关闭 -->
      <div v-if="showAccount" class="header__account-panel" @click.stop>
        <template v-if="loggedIn">
          <p class="header__account-title">已登录</p>
          <p class="header__account-id">{{ accountId }}</p>
          <p class="header__account-fp">指纹 {{ fingerprint.slice(0, 8) }}</p>
          <button class="header__account-submit" @click="logout">退出登录</button>
          <p class="header__account-hint">
            歌单已同步到云端。换设备输入同样的 ID 和密码即可取回 —— 指纹一致就是同一个身份。
          </p>
        </template>

        <template v-else>
          <p class="header__account-title">登录 / 创建 ID</p>
          <input
            v-model="accountId"
            class="header__account-input"
            placeholder="用户 ID，随便起"
            autocomplete="off"
          />
          <input
            v-model="accountPass"
            type="password"
            class="header__account-input"
            :placeholder="`密码（至少 ${MIN_PASS} 位）`"
            autocomplete="new-password"
            @keydown.enter="submitAccount"
          />
          <button class="header__account-submit header__account-submit--primary" @click="submitAccount">
            创建并登录
          </button>
          <p class="header__account-hint">
            第一次用就随便起一个 ID 和密码 —— 这个 ID 不存在会自动新建（歌单是空的）。
            <br />⚠️ 这是自定义口令，<b>别用你其它网站的密码</b>。
          </p>
          <p v-if="accountError" class="header__account-error">{{ accountError }}</p>
        </template>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* 悬浮透明顶栏 */
.header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--topbar-height);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 0 var(--page-gutter);
  z-index: 60;
  user-select: none;
}

.header__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.header__logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
}

.header__title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.92);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}

/* 后缀署名：比标题暗一档、小一号，读起来像 handle 而不是第二个标题。
   跟着 .header__logo 的 flex gap（8px）排，不额外加间距。 */
.header__handle {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.5);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
  white-space: nowrap;
}

.header__nav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: var(--spacing-md);
}

.nav-link {
  padding: 5px 18px;
  font-size: 12px;
  border-radius: 4px;
  color: #fff;
  background: var(--glass-bg-strong);
  backdrop-filter: blur(2px);
  transition: background var(--transition-fast);
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.3);
  color: #fff;
}

.nav-link.active {
  background: var(--accent);
  color: #fff;
}

/* 顶栏中部留白：搜索框已移除，核心入口在主页按钮条（对齐参考站） */
.header__spacer {
  flex: 1;
}

.header__right {
  /* 账号浮层的定位基准 */
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.header__account-btn,
.header__settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.85);
  background: var(--glass-bg-strong);
  backdrop-filter: blur(2px);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.header__account-btn:hover,
.header__settings-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  color: #fff;
}

/* 已登录时点亮，一眼看出当前身份有效 */
.header__account-btn--on {
  color: var(--accent);
}

/* ===== 账号浮层 ===== */
.header__account-panel {
  position: absolute;
  top: 40px;
  right: 0;
  width: 236px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(20, 20, 20, 0.94);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 80;
}

.header__account-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.header__account-id {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
  word-break: break-all;
}

.header__account-fp {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  font-variant-numeric: tabular-nums;
  margin-top: -4px;
}

.header__account-input {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  color: #fff;
  background: rgba(255, 255, 255, 0.09);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  outline: none;
}

.header__account-input:focus {
  border-color: var(--accent);
}

.header__account-input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.header__account-submit {
  height: 32px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.header__account-submit:hover {
  background: rgba(255, 255, 255, 0.2);
}

.header__account-submit--primary {
  background: var(--accent);
}

.header__account-submit--primary:hover {
  background: var(--color-primary-hover);
}

.header__account-hint {
  font-size: 11px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.45);
}

.header__account-error {
  font-size: 11px;
  color: #ff8a8a;
}

@media (max-width: 767px) {
  .header__nav {
    display: none;
  }
  .header__title {
    font-size: 17px;
  }
  .header__handle {
    font-size: 12px;
  }
}
</style>
