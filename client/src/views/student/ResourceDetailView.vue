<template>
  <div class="page-container">
    <div style="margin-bottom:16px">
      <el-button text :icon="'ArrowLeft'" @click="goBack">
        返回列表
      </el-button>
    </div>

    <!-- Loading -->
    <div v-if="loading" style="text-align:center;padding:60px">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <p style="margin-top:12px;color:#909399">加载中...</p>
    </div>

    <!-- Resource detail -->
    <div v-else-if="resource" class="detail-card">
      <div class="detail-header">
        <div :class="['file-type-icon', resource.file_type, 'large']">
          {{ resource.file_type.toUpperCase() }}
        </div>
        <div class="detail-info">
          <h2>{{ resource.title }}</h2>
          <div class="detail-meta">
            <span>{{ resource.category_name }}</span>
            <el-divider direction="vertical" />
            <span>{{ resource.sizeLabel }}</span>
            <el-divider direction="vertical" />
            <span>{{ resource.file_type?.toUpperCase() }} 文件</span>
            <el-divider direction="vertical" />
            <span>上传者：{{ resource.uploader_name }}</span>
            <el-divider direction="vertical" />
            <span>{{ formatDate(resource.created_at) }}</span>
          </div>
        </div>
      </div>

      <el-divider />

      <div class="detail-body">
        <h4>资源描述</h4>
        <p>{{ resource.description || '暂无描述' }}</p>
      </div>

      <div class="detail-stats">
        <div class="stat-item">
          <span class="stat-value">{{ resource.download_count }}</span>
          <span class="stat-label">下载次数</span>
        </div>
      </div>

      <div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap">
        <el-button
          type="primary"
          size="large"
          :icon="'Download'"
          @click="handleDownload"
          :disabled="resource.status !== 'approved' && !isAdmin"
        >
          {{ resource.status === 'approved' ? '下载文件' : '暂不可下载' }}
        </el-button>
        <el-button
          v-if="resource.status === 'approved'"
          size="large"
          :icon="'View'"
          @click="handlePreview"
        >
          在线预览
        </el-button>
        <span v-if="resource.status !== 'approved'" style="color:#909399;font-size:13px">
          该资源尚未通过审核
        </span>
      </div>
    </div>

    <!-- Not found -->
    <div v-else class="empty-state">
      <el-icon><FolderDelete /></el-icon>
      <p>资源不存在或已被删除</p>
      <el-button style="margin-top:12px" @click="$router.push('/resources')">返回资源列表</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getResourceDetail } from '@/api/resourceApi'
import { downloadResource } from '@/api/userApi'
import { useAuthStore } from '@/stores/authStore'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const resource = ref(null)
const loading = ref(true)
const isAdmin = computed(() => authStore.isAdmin)

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

function handleDownload() {
  if (resource.value) {
    downloadResource(resource.value.id)
  }
}

function handlePreview() {
  if (resource.value) {
    const token = localStorage.getItem('accessToken')
    window.open(`/api/v1/resources/${resource.value.id}/preview?token=${token}`, '_blank')
  }
}

function goBack() {
  if (resource.value?.course_id) {
    router.push({ path: '/resources', query: { course_id: resource.value.course_id } })
  } else {
    router.push('/resources')
  }
}

onMounted(async () => {
  try {
    const res = await getResourceDetail(route.params.id)
    resource.value = res.data
  } catch {
    resource.value = null
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.detail-card {
  background: #fff;
  border-radius: 8px;
  padding: 32px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.detail-header {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.file-type-icon.large {
  width: 56px;
  height: 56px;
  font-size: 16px;
  border-radius: 12px;
}

.detail-info {
  flex: 1;
}

.detail-info h2 {
  font-size: 22px;
  margin-bottom: 12px;
}

.detail-meta {
  color: #909399;
  font-size: 13px;
}

.detail-body {
  margin-bottom: 20px;
}

.detail-body h4 {
  font-size: 16px;
  margin-bottom: 8px;
}

.detail-body p {
  color: #606266;
  line-height: 1.6;
}

.detail-stats {
  display: flex;
  gap: 32px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 600;
  color: #409eff;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
