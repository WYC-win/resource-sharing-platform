<template>
  <div class="mobile-admin">
    <!-- Header -->
    <div class="ma-header">
      <div class="ma-title">📖 北地书阁</div>
      <div style="display:flex;gap:8px;align-items:center">
        <el-button text size="small" @click="sessionStorage.setItem('adminDesktopMode','1'); $router.push('/admin/dashboard')">电脑版</el-button>
        <el-button text size="small" @click="authStore.logout(); $router.push('/login')">退出</el-button>
      </div>
    </div>

    <div class="ma-body" v-loading="loading">
      <!-- Stats -->
      <div class="ma-stats">
        <div class="ma-stat">
          <div class="ma-stat-num">{{ stats.resources?.total || 0 }}</div>
          <div class="ma-stat-label">总资源</div>
        </div>
        <div class="ma-stat" style="background:#fdf6ec" @click="tab = 'review'">
          <div class="ma-stat-num" style="color:#e6a23c">{{ stats.resources?.pending || 0 }}</div>
          <div class="ma-stat-label">待审核</div>
        </div>
        <div class="ma-stat" style="background:#f0f9eb">
          <div class="ma-stat-num" style="color:#67c23a">{{ stats.resources?.approved || 0 }}</div>
          <div class="ma-stat-label">已通过</div>
        </div>
        <div class="ma-stat">
          <div class="ma-stat-num">{{ stats.visits?.total || 0 }}</div>
          <div class="ma-stat-label">总访问</div>
        </div>
      </div>

      <!-- Tab bar -->
      <div class="ma-tabs">
        <div :class="['ma-tab', { active: tab === 'review' }]" @click="tab = 'review'">待审核</div>
        <div :class="['ma-tab', { active: tab === 'done' }]" @click="tab = 'done'">已处理</div>
      </div>

      <!-- Review list -->
      <div v-if="tab === 'review'" class="ma-list">
        <div v-if="pendingList.length === 0" class="ma-empty">暂无待审核资源</div>
        <div v-for="item in pendingList" :key="item.id" class="ma-item">
          <div class="ma-item-top">
            <div class="ma-item-title">{{ item.title }}</div>
            <div :class="['ma-item-type', item.file_type]">{{ item.file_type?.toUpperCase() }}</div>
          </div>
          <div class="ma-item-meta">
            {{ item.uploader_name }} · {{ item.sizeLabel }} · {{ item.created_at?.slice(0,10) }}
          </div>
          <div v-if="item.description" class="ma-item-desc">{{ item.description }}</div>
          <div class="ma-item-actions">
            <el-button size="small" text @click="showPreview(item)">预览</el-button>
            <div style="flex:1" />
            <el-button size="small" type="danger" plain @click="rejectItem(item)">驳回</el-button>
            <el-button size="small" type="success" @click="approveItem(item)">通过</el-button>
          </div>
        </div>

        <div v-if="pendingTotal > pendingList.length" class="ma-load-more" @click="loadMore">
          加载更多 ({{ pendingList.length }}/{{ pendingTotal }})
        </div>
      </div>

      <!-- Done list -->
      <div v-if="tab === 'done'" class="ma-list">
        <div v-if="doneList.length === 0" class="ma-empty">暂无已处理记录</div>
        <div v-for="item in doneList" :key="item.id" class="ma-item">
          <div class="ma-item-top">
            <div class="ma-item-title">{{ item.title }}</div>
            <el-tag :type="item.status === 'approved' ? 'success' : 'danger'" size="small">
              {{ item.status === 'approved' ? '通过' : '驳回' }}
            </el-tag>
          </div>
          <div class="ma-item-meta">
            {{ item.uploader_name }} · {{ item.created_at?.slice(0,10) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Preview dialog -->
    <el-dialog v-model="previewVisible" title="预览" width="95%" style="max-width:500px">
      <div v-if="previewItem">
        <h4 style="margin:0 0 8px">{{ previewItem.title }}</h4>
        <p style="margin:0 0 4px;font-size:13px;color:#909399">
          {{ previewItem.uploader_name }} · {{ previewItem.category_name || '未分类' }}
        </p>
        <p v-if="previewItem.description" style="margin:0 0 12px;font-size:13px">{{ previewItem.description }}</p>
        <div style="display:flex;gap:8px">
          <el-button size="small" :icon="'View'" @click="doPreview(previewItem)">预览文件</el-button>
          <el-button size="small" :icon="'Download'" @click="doDownload(previewItem)">下载</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/authStore'
import request from '@/api/request'
import { getAdminResources, reviewResource } from '@/api/resourceApi'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const tab = ref('review')
const stats = ref({})

const pendingList = ref([])
const pendingTotal = ref(0)
const pendingPage = ref(1)

const doneList = ref([])
const donePage = ref(1)

const previewVisible = ref(false)
const previewItem = ref(null)

async function loadStats() {
  try {
    const r = await request.get('/stats/overview')
    stats.value = r.data || {}
  } catch {}
}

async function loadPending() {
  try {
    const r = await getAdminResources({ status: 'pending', page: pendingPage.value, pageSize: 20 })
    if (pendingPage.value === 1) {
      pendingList.value = r.data || []
    } else {
      pendingList.value.push(...(r.data || []))
    }
    pendingTotal.value = r.meta?.total || 0
  } catch {}
}

async function loadDone() {
  try {
    // Get recently processed (approved + rejected)
    const [approved, rejected] = await Promise.all([
      getAdminResources({ status: 'approved', page: donePage.value, pageSize: 10 }),
      getAdminResources({ status: 'rejected', page: donePage.value, pageSize: 10 }),
    ])
    const all = [...(approved.data || []), ...(rejected.data || [])]
    all.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
    doneList.value = all.slice(0, 20)
  } catch {}
}

function loadMore() {
  pendingPage.value++
  loadPending()
}

async function approveItem(item) {
  try {
    await reviewResource(item.id, { status: 'approved' })
    ElMessage.success('已通过')
    pendingList.value = pendingList.value.filter(i => i.id !== item.id)
    pendingTotal.value--
    loadStats()
  } catch {}
}

function rejectItem(item) {
  ElMessageBox.prompt('驳回原因（选填）', '驳回资源', { inputType: 'textarea', inputPlaceholder: '原因...' })
    .then(async ({ value }) => {
      await reviewResource(item.id, { status: 'rejected', review_note: value || '' })
      ElMessage.success('已驳回')
      pendingList.value = pendingList.value.filter(i => i.id !== item.id)
      pendingTotal.value--
      loadStats()
    })
    .catch(() => {})
}

function showPreview(item) {
  previewItem.value = item
  previewVisible.value = true
}

function doPreview(item) {
  const token = localStorage.getItem('accessToken')
  window.open(`/api/v1/resources/${item.id}/preview?token=${token}`, '_blank')
}

function doDownload(item) {
  const token = localStorage.getItem('accessToken')
  window.open(`/api/v1/resources/${item.id}/download?token=${token}`, '_blank')
}

onMounted(async () => {
  loading.value = true
  await Promise.all([loadStats(), loadPending(), loadDone()])
  loading.value = false
})
</script>

<style scoped>
.mobile-admin {
  min-height: 100vh;
  background: #f5f7fa;
}
.ma-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}
.ma-title {
  font-size: 16px;
  font-weight: 600;
}
.ma-body {
  padding: 12px;
}
.ma-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}
.ma-stat {
  background: #f0f5ff;
  border-radius: 10px;
  padding: 14px;
  text-align: center;
}
.ma-stat-num {
  font-size: 22px;
  font-weight: 700;
  color: #409eff;
}
.ma-stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}
.ma-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 12px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}
.ma-tab {
  flex: 1;
  text-align: center;
  padding: 10px;
  font-size: 14px;
  cursor: pointer;
  color: #909399;
  border-bottom: 2px solid transparent;
}
.ma-tab.active {
  color: #409eff;
  border-bottom-color: #409eff;
  font-weight: 600;
}
.ma-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ma-item {
  background: #fff;
  border-radius: 10px;
  padding: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.ma-item-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
}
.ma-item-title {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  flex: 1;
}
.ma-item-type {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.ma-item-type.pdf { background: #f56c6c; }
.ma-item-type.doc, .ma-item-type.docx { background: #409eff; }
.ma-item-type.ppt, .ma-item-type.pptx { background: #e6a23c; }
.ma-item-type.xls, .ma-item-type.xlsx { background: #67c23a; }
.ma-item-meta {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.ma-item-desc {
  font-size: 12px;
  color: #606266;
  margin-bottom: 8px;
  padding: 6px 8px;
  background: #f5f7fa;
  border-radius: 4px;
}
.ma-item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}
.ma-load-more {
  text-align: center;
  padding: 14px;
  color: #409eff;
  font-size: 14px;
  cursor: pointer;
}
.ma-empty {
  text-align: center;
  padding: 40px 20px;
  color: #909399;
  font-size: 14px;
}
</style>
