<template>
  <div class="sidebar-wrapper">
    <el-menu
      :default-active="activeMenu"
      class="admin-sidebar"
      router
      :collapse="false"
      @select="closeOnMobile"
    >
      <div class="sidebar-title">管理后台</div>

      <el-menu-item index="/admin/dashboard">
        <el-icon><DataAnalysis /></el-icon>
        <span>仪表盘</span>
      </el-menu-item>

      <el-menu-item index="/admin/review">
        <el-icon><Edit /></el-icon>
        <span>资源审核</span>
        <el-badge v-if="pendingCount > 0" :value="pendingCount" :max="99" style="margin-left:auto;line-height:1" />
      </el-menu-item>

      <el-menu-item index="/admin/resources">
        <el-icon><Files /></el-icon>
        <span>资源管理</span>
      </el-menu-item>

      <el-menu-item index="/admin/users">
        <el-icon><User /></el-icon>
        <span>用户管理</span>
      </el-menu-item>

      <el-menu-item index="/admin/categories">
        <el-icon><Collection /></el-icon>
        <span>分类管理</span>
      </el-menu-item>

      <el-menu-item index="/admin/courses">
        <el-icon><Notebook /></el-icon>
        <span>课程管理</span>
      </el-menu-item>

      <el-menu-item index="/admin/announcements">
        <el-icon><WarningFilled /></el-icon>
        <span>公告管理</span>
      </el-menu-item>

      <el-menu-item index="/admin/logs">
        <el-icon><Timer /></el-icon>
        <span>实时日志</span>
      </el-menu-item>

      <div class="sidebar-divider" />

      <el-menu-item index="/resources">
        <el-icon><View /></el-icon>
        <span>返回前台</span>
      </el-menu-item>
    </el-menu>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getAdminResources } from '@/api/resourceApi'

const route = useRoute()
const pendingCount = ref(0)

const activeMenu = computed(() => route.path)

function closeOnMobile() {
  if (window.innerWidth <= 768) {
    const overlay = document.querySelector('.sidebar-overlay')
    if (overlay) overlay.click()
  }
}

async function loadPendingCount() {
  try {
    const res = await getAdminResources({ status: 'pending', pageSize: 1 })
    pendingCount.value = res.meta?.total || 0
  } catch {
    // ignore
  }
}

onMounted(() => {
  loadPendingCount()
})
</script>

<style scoped>
.sidebar-wrapper {
  position: fixed;
  left: 0;
  top: 60px;
  bottom: 0;
  width: 220px;
  z-index: 100;
}

.admin-sidebar {
  height: 100% !important;
  overflow-y: auto;
  border-right: 1px solid #e4e7ed;
  background: #fff;
}

.sidebar-title {
  padding: 16px 20px;
  font-size: 14px;
  font-weight: 600;
  color: #909399;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 8px;
}

.sidebar-divider {
  height: 1px;
  background: #e4e7ed;
  margin: 8px 12px;
}

@media (max-width: 768px) {
  .sidebar-wrapper {
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  .sidebar-wrapper.sidebar-open {
    transform: translateX(0);
  }
  .admin-sidebar {
    max-width: 220px;
  }
}
</style>
