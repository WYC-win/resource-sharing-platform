<template>
  <component :is="layout">
    <router-view />
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
      <p>本平台资料仅供校内学习交流使用。如您发现资料侵犯了您的合法权益，请通过管理员邮箱 <strong>3540808840@qq.com</strong> 联系我们，我们将在核实后尽快处理。</p>
      <p><strong>3. 永久免费</strong></p>
      <p>本网站永久免费，为爱发电。不收取任何费用，请放心使用。</p>
      <p><strong>4. 使用规范</strong></p>
      <p>请勿将本平台资料用于任何商业用途，请勿向外校人员传播。使用本平台即表示您同意以上条款。</p>
    </div>
    <div style="text-align:center;margin-top:8px">
      <el-button
        type="primary"
        :disabled="countdown > 0"
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
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { useAuthStore } from '@/stores/authStore'

const route = useRoute()
const authStore = useAuthStore()

const showDisclaimer = ref(false)
const countdown = ref(5)
let timer = null

const layout = computed(() => {
  if (route.meta.layout === 'none') return 'div'
  if (route.meta.requiresAdmin || route.path.startsWith('/admin')) return AdminLayout
  return DefaultLayout
})

function checkDisclaimer() {
  const accepted = localStorage.getItem('disclaimerAccepted')
  if (!accepted && authStore.isLoggedIn && !authStore.isAdmin) {
    showDisclaimer.value = true
    countdown.value = 5
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
        timer = null
      }
    }, 1000)
  }
}

function acceptDisclaimer() {
  localStorage.setItem('disclaimerAccepted', 'true')
  showDisclaimer.value = false
  if (timer) { clearInterval(timer); timer = null; }
}

// Check after login navigation completes
watch(() => route.path, () => {
  if (authStore.isLoggedIn && route.path !== '/login') {
    nextTick(() => checkDisclaimer())
  }
})

// Also check when login state changes
watch(() => authStore.isLoggedIn, (val) => {
  if (val && route.path !== '/login') {
    nextTick(() => checkDisclaimer())
  }
})

// Check on mount (e.g. page refresh)
onMounted(() => {
  nextTick(() => {
    if (authStore.isLoggedIn && route.path !== '/login') {
      checkDisclaimer()
    }
  })
})
</script>
