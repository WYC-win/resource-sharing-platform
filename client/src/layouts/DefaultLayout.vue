<template>
  <div class="default-layout">
    <AppHeader />
    <main class="main-content">
      <router-view />
    </main>
    <footer class="site-footer">
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">冀ICP备2026007969号-2</a>
      <span class="footer-divider">|</span>
      <span>🐚 北地书阁已运行 {{ runtime }}</span>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppHeader from '@/components/common/AppHeader.vue'

const startDate = new Date('2026-07-10T00:00:00')
const now = ref(Date.now())
let timer = null

const runtime = computed(() => {
  const diff = Math.floor((now.value - startDate.getTime()) / 1000)
  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  const seconds = diff % 60
  return `${days} 天 ${hours} 小时 ${minutes} 分 ${seconds} 秒`
})

onMounted(() => {
  timer = setInterval(() => { now.value = Date.now() }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.default-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  width: 100%;
}

.main-content {
  flex: 1;
  padding-top: 60px;
}

.site-footer {
  text-align: center;
  padding: 16px 20px;
  font-size: 13px;
  color: #909399;
  background: #fff;
  border-top: 1px solid #e4e7ed;
}
.site-footer a {
  color: #909399;
  text-decoration: none;
}
.site-footer a:hover {
  color: #409eff;
}
.footer-divider {
  margin: 0 10px;
  color: #dcdfe6;
}

@media (max-width: 768px) {
  .site-footer {
    font-size: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: center;
  }
  .footer-divider {
    display: none;
  }
}
</style>
