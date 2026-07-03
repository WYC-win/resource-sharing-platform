<template>
  <div class="page-container">
    <div class="page-title">
      <span>我的上传</span>
      <el-button type="primary" :icon="'Upload'" @click="showUpload = true">
        上传新资源
      </el-button>
    </div>

    <el-card v-if="!loading && uploads.length === 0" class="empty-state">
      <el-icon><FolderOpened /></el-icon>
      <p>还没有上传过资源，点击右上角开始上传</p>
    </el-card>

    <el-table v-else :data="uploads" stripe style="width:100%" v-loading="loading">
      <el-table-column prop="title" label="资源标题" min-width="200">
        <template #default="{ row }">
          <div style="display:flex;align-items:center;gap:8px">
            <div :class="['file-type-icon', 'small', row.file_type]">
              {{ row.file_type?.toUpperCase() }}
            </div>
            <span>{{ row.title }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="category_name" label="分类" width="120" />
      <el-table-column prop="file_type" label="格式" width="80">
        <template #default="{ row }">
          {{ row.file_type?.toUpperCase() }}
        </template>
      </el-table-column>
      <el-table-column prop="file_size" label="大小" width="100">
        <template #default="{ row }">
          {{ row.sizeLabel }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="download_count" label="下载" width="70" align="center" />
      <el-table-column prop="created_at" label="上传时间" width="170">
        <template #default="{ row }">
          {{ formatDate(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'rejected'"
            text
            type="danger"
            size="small"
            @click="showReviewNote(row)"
          >
            查看原因
          </el-button>
          <el-button
            v-if="row.status === 'pending'"
            text
            type="danger"
            size="small"
            @click="handleDelete(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Pagination -->
    <div v-if="total > 0" style="text-align:center;margin-top:20px">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="loadUploads"
      />
    </div>

    <!-- Upload Dialog -->
    <UploadDialog v-model:visible="showUpload" @success="loadUploads" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { getMyUploads, deleteResource } from '@/api/resourceApi'
import UploadDialog from '@/components/resource/UploadDialog.vue'
import dayjs from 'dayjs'

const uploads = ref([])
const loading = ref(false)
const showUpload = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

function statusType(status) {
  const map = { pending: 'warning', approved: 'success', rejected: 'danger' }
  return map[status] || 'info'
}

function statusLabel(status) {
  const map = { pending: '待审核', approved: '已通过', rejected: '已驳回' }
  return map[status] || status
}

async function loadUploads() {
  loading.value = true
  try {
    const res = await getMyUploads({ page: page.value, pageSize: pageSize.value })
    uploads.value = res.data
    total.value = res.meta?.total || 0
  } catch {
    uploads.value = []
  } finally {
    loading.value = false
  }
}

function showReviewNote(row) {
  ElMessageBox.alert(row.review_note || '管理员未填写驳回原因', '驳回原因', {
    confirmButtonText: '知道了',
  })
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除「${row.title}」吗？`, '确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteResource(row.id)
    ElMessage.success('删除成功')
    loadUploads()
  } catch {
    // cancelled
  }
}

onMounted(loadUploads)
</script>

<style scoped>
.file-type-icon.small {
  width: 28px;
  height: 28px;
  font-size: 10px;
  border-radius: 4px;
}
</style>
