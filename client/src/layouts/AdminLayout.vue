<template>
  <div class="admin-layout">
    <AppHeader @toggle-sidebar="sidebarOpen = !sidebarOpen" />
    <div class="admin-body">
      <!-- Overlay for mobile -->
      <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false" />
      <AppSidebar :class="{ 'sidebar-open': sidebarOpen }" />
      <main class="admin-main">
        <div class="page-container">
          <router-view />
        </div>
      </main>
    </div>
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
import AppSidebar from '@/components/common/AppSidebar.vue'

const sidebarOpen = ref(false)

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
.admin-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  width: 100%;
}

.admin-body {
  display: flex;
  flex: 1;
  padding-top: 60px;
  position: relative;
}

.admin-main {
  flex: 1;
  margin-left: 220px;
  min-height: calc(100vh - 60px);
  background: #f5f7fa;
}

.sidebar-overlay {
  display: none;
}

.site-footer {
  text-align: center;
  padding: 12px 20px;
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
  .admin-main {
    margin-left: 0;
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    top: 60px;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 99;
  }

  .site-footer {
    font-size: 12px;
    padding: 10px;
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
