<template>
  <el-header class="app-header">
    <div class="header-inner">
      <div class="header-left">
        <!-- Mobile menu toggle (admin only) -->
        <el-button v-if="authStore.isAdmin && authStore.isLoggedIn" class="mobile-menu-btn desktop-only" text :icon="'Operation'" @click="$emit('toggle-sidebar')" />
        <router-link to="/resources" class="logo">
          <el-icon :size="24"><Reading /></el-icon>
          <span class="logo-text">📖 北地书阁</span>
        </router-link>
      </div>

      <div class="header-right">
        <template v-if="authStore.isLoggedIn">
          <el-dropdown trigger="click" @command="handleCommand">
            <span class="user-info">
              <el-avatar :size="32" style="background:transparent;font-size:20px">📚</el-avatar>
              <span class="username desktop-only">{{ authStore.displayName }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>个人信息
                </el-dropdown-item>
                <el-dropdown-item command="password">
                  <el-icon><Lock /></el-icon>修改密码
                </el-dropdown-item>
                <el-dropdown-item v-if="authStore.isAdmin" command="admin" divided>
                  <el-icon><Setting /></el-icon>管理后台
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </div>
    </div>
  </el-header>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { ElMessageBox } from 'element-plus'

defineEmits(['toggle-sidebar'])

const router = useRouter()
const authStore = useAuthStore()

function handleCommand(command) {
  switch (command) {
    case 'profile':
      break
    case 'password':
      router.push('/login')
      break
    case 'admin':
      router.push('/admin/dashboard')
      break
    case 'logout':
      ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }).then(() => {
        authStore.logout()
        router.push('/login')
      }).catch(() => {})
      break
  }
}
</script>

<style scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  padding: 0 !important;
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: #303133;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.user-info:hover {
  background: #f5f7fa;
}

.username {
  font-size: 14px;
  color: #303133;
}

.mobile-menu-btn {
  display: none;
}

@media (max-width: 768px) {
  .header-inner {
    padding: 0 12px;
  }
  .logo-text {
    font-size: 16px;
  }
  .mobile-menu-btn {
    display: inline-flex !important;
  }
}
</style>
