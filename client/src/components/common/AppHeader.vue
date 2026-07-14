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
          <!-- Announcement button -->
          <span style="display:inline-flex;align-items:center;gap:4px;cursor:pointer" @click="showAnnouncements">
            <el-badge :is-dot="hasNewAnnouncement" style="line-height:1">
              <el-button text :icon="'Bell'" style="font-size:18px;padding:6px" />
            </el-badge>
            <span style="font-size:13px;color:#606266;user-select:none">公告</span>
          </span>

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

    <!-- Announcement dialog -->
    <el-dialog v-model="announceVisible" title="📢 平台公告" width="520px" @closed="onAnnounceClosed">
      <div v-if="announceLoading" style="text-align:center;padding:40px;color:#909399">加载中...</div>
      <div v-else-if="announceList.length === 0" style="text-align:center;padding:40px;color:#909399">暂无公告</div>
      <div v-else class="announce-list">
        <div
          v-for="item in announceList"
          :key="item.id"
          class="announce-item"
          :class="{ pinned: item.is_pinned }"
        >
          <div class="announce-item-header">
            <span class="announce-item-title">
              <el-tag v-if="item.is_pinned" size="small" type="warning" style="margin-right:6px">置顶</el-tag>
              {{ item.title }}
            </span>
            <span class="announce-item-date">{{ item.published_at }}</span>
          </div>
          <div class="announce-item-content">{{ item.content }}</div>
        </div>
      </div>
    </el-dialog>
  </el-header>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { ElMessageBox } from 'element-plus'
import { getAnnouncements } from '@/api/announcementApi'

defineEmits(['toggle-sidebar'])

const router = useRouter()
const authStore = useAuthStore()

const announceVisible = ref(false)
const announceLoading = ref(false)
const announceList = ref([])
const hasNewAnnouncement = ref(false)

const LAST_VIEWED_KEY = 'announce_last_viewed'

async function checkNewAnnouncements() {
  try {
    const res = await getAnnouncements()
    const list = res.data || []
    if (list.length === 0) {
      hasNewAnnouncement.value = false
      return
    }
    const lastViewed = localStorage.getItem(LAST_VIEWED_KEY)
    if (!lastViewed) {
      hasNewAnnouncement.value = true
      return
    }
    // Check if any announcement is newer than last viewed
    hasNewAnnouncement.value = list.some(a => {
      if (!a.published_at) return false
      return new Date(a.published_at).getTime() > parseInt(lastViewed, 10)
    })
  } catch {
    hasNewAnnouncement.value = false
  }
}

async function showAnnouncements() {
  announceVisible.value = true
  announceLoading.value = true
  try {
    const res = await getAnnouncements()
    announceList.value = res.data || []
  } catch {
    announceList.value = []
  } finally {
    announceLoading.value = false
  }
}

function onAnnounceClosed() {
  // Record the current time as last viewed
  localStorage.setItem(LAST_VIEWED_KEY, Date.now().toString())
  hasNewAnnouncement.value = false
}

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

onMounted(() => {
  if (authStore.isLoggedIn) {
    checkNewAnnouncements()
  }
})
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

.announce-list {
  max-height: 420px;
  overflow-y: auto;
}

.announce-item {
  padding: 14px 0;
  border-bottom: 1px solid #f0f0f0;
}

.announce-item:last-child {
  border-bottom: none;
}

.announce-item.pinned {
  background: #fffbf0;
  margin: 0 -16px;
  padding: 14px 16px;
  border-radius: 4px;
}

.announce-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.announce-item-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.announce-item-date {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
  margin-left: 12px;
}

.announce-item-content {
  font-size: 13px;
  color: #606266;
  line-height: 1.7;
  white-space: pre-wrap;
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
