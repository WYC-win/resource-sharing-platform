<template>
  <component :is="layout">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </component>

  <!-- Disclaimer dialog for first-time visitors -->
  <el-dialog
    v-model="showDisclaimer"
    title="免责声明"
    width="480px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
  >
    <div style="line-height:1.8;font-size:14px;color:#303133">
      <p>欢迎使用北地书阁！在使用本平台前，请仔细阅读以下声明：</p>
      <p><strong>1. 内容真实性</strong></p>
      <p>本平台所有学习资料均为自行搜集或校友分享，<strong>平台不保证题目的真实性、准确性或完整性</strong>。题目内容可能存在回忆偏差、答案错误等情况，请同学们在使用时自行辨别、多方求证。</p>
      <p><strong>2. 版权声明</strong></p>
      <p>本平台资料仅供校内学习交流使用。如您发现资料侵犯了您的合法权益，请通过管理员邮箱 <strong>jackson_win@qq.com</strong> 联系我们，我们将在核实后尽快处理。</p>
      <p><strong>3. 永久免费</strong></p>
      <p>本网站永久免费，为爱发电。不收取任何费用，请放心使用。</p>
      <p><strong>4. 使用规范</strong></p>
      <p>请勿将本平台资料用于任何商业用途，请勿向外校人员传播。使用本平台即表示您同意以上条款。</p>
    </div>
    <div style="text-align:center;margin-top:8px">
      <el-button
        type="primary"
        :disabled="countdown > 0"
        :loading="accepting"
        @click="acceptDisclaimer"
        style="min-width:160px"
      >
        {{ countdown > 0 ? `请阅读 ${countdown}s` : '我已阅读并同意' }}
      </el-button>
    </div>
  </el-dialog>

</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { useAuthStore } from '@/stores/authStore'
import * as authApi from '@/api/authApi'
import { isTokenExpired } from '@/utils/jwt'

const route = useRoute()
const authStore = useAuthStore()

const showDisclaimer = ref(false)
const countdown = ref(5)
const accepting = ref(false)
let timer = null

// 强制阅读时长（秒）
const DISCLAIMER_SECONDS = 5

const layout = computed(() => {
  if (route.meta.layout === 'none') return 'div'
  if (route.meta.requiresAdmin || route.path.startsWith('/admin')) return AdminLayout
  return DefaultLayout
})

// 打开弹窗并开始倒计时。已经在显示时直接返回，避免路由切换把倒计时重置。
function openDisclaimer() {
  if (showDisclaimer.value) return
  countdown.value = DISCLAIMER_SECONDS
  showDisclaimer.value = true
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

function closeDisclaimer() {
  showDisclaimer.value = false
  if (timer) { clearInterval(timer); timer = null; }
}

/**
 * 是否需要强制弹出免责声明。
 * 规则：普通学生只要从未同意过就弹一次；同意一次后永久不再弹。
 */
function checkDisclaimer() {
  if (!authStore.isLoggedIn || authStore.isAdmin) return false

  // 两条令牌都失效时，登录其实已经作废（路由守卫会把人送回登录页），这里不弹。
  // 只过期 access token 是可以自动刷新的，此时会话仍然有效，该弹。
  const accessExpired = isTokenExpired(authStore.token)
  const canRefresh = !!authStore.refreshTokenValue && !isTokenExpired(authStore.refreshTokenValue)
  if (accessExpired && !canRefresh) return false

  // 已有同意记录 → 永久不再弹
  if (authStore.user?.disclaimer_accepted_at) return false

  openDisclaimer()
  return true
}

async function acceptDisclaimer() {
  if (accepting.value) return
  accepting.value = true
  try {
    await authApi.acceptDisclaimer()
    // 关键修复：必须用 setUser 同时写入 Pinia 和 localStorage。
    // 之前只改 authStore.user（内存），localStorage 里仍是 null，
    // 刷新页面后 initFromStorage() 会把旧值读回来，导致弹窗反复出现。
    authStore.setUser({
      ...authStore.user,
      disclaimer_accepted_at: new Date().toISOString(),
    })
    closeDisclaimer()
  } catch (err) {
    // 不能静默失败：没存上就保留弹窗，提示用户重试
    ElMessage.error('保存失败，请检查网络后重试')
  } finally {
    accepting.value = false
  }
}

// Check after login navigation completes
watch(() => route.path, () => {
  if (authStore.isLoggedIn && route.path !== '/login') {
    nextTick(() => checkDisclaimer())
  }
})

// Also check when login state changes
watch(() => authStore.isLoggedIn, (val) => {
  if (!val) {
    // Logged out (e.g. token refresh failed and we were redirected to login):
    // make sure a stale disclaimer dialog is not left hanging on the login page.
    closeDisclaimer()
    return
  }
  if (route.path !== '/login') {
    nextTick(() => checkDisclaimer())
  }
})

// Check on mount (e.g. page refresh).
// 先从服务端拉一次最新资料覆盖本地缓存，再判断要不要弹：
// 这样即使用户换了设备、清了浏览器缓存，只要数据库里有同意记录就不会重复弹。
onMounted(async () => {
  if (!authStore.isLoggedIn || route.path === '/login') return
  try {
    const res = await authApi.getProfile()
    if (res?.data) authStore.setUser(res.data)
  } catch (err) {
    // 拉取失败就退回本地缓存判断，不阻塞页面
  }
  if (!authStore.isLoggedIn) return
  nextTick(() => checkDisclaimer())
})
</script>
