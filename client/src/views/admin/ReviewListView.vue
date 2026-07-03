<template>
  <div class="page-container">
    <div class="page-title">
      <span>资源审核</span>
    </div>

    <el-table :data="resources" stripe v-loading="loading">
      <el-table-column prop="title" label="资源标题" min-width="200" show-overflow-tooltip />
      <el-table-column prop="uploader_name" label="上传者" width="120" />
      <el-table-column prop="category_name" label="分类" width="100" />
      <el-table-column prop="file_type" label="格式" width="70">
        <template #default="{ row }">{{ row.file_type?.toUpperCase() }}</template>
      </el-table-column>
      <el-table-column prop="sizeLabel" label="大小" width="90" />
      <el-table-column prop="created_at" label="上传时间" width="170" />
      <el-table-column label="操作" width="210" fixed="right" @click.stop>
        <template #default="{ row }">
          <div style="display:flex;gap:6px;align-items:center">
            <el-button text size="small" @click.stop="showDetail(row)">查看</el-button>
            <el-button type="success" size="small" @click.stop="openApproveDialog(row)">通过</el-button>
            <el-button type="danger" size="small" @click.stop="handleReject(row)">驳回</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > 0" style="text-align:center;margin-top:20px">
      <el-pagination
        v-model:current-page="page"
        :page-size="20"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="loadReviews"
      />
    </div>

    <!-- Detail dialog -->
    <el-dialog v-model="detailVisible" title="资源详情" width="560px">
      <template v-if="detailRow">
        <div style="display:flex;gap:12px;margin-bottom:16px">
          <div :class="['file-type-icon', detailRow.file_type]" style="width:48px;height:48px;font-size:14px;flex-shrink:0">
            {{ detailRow.file_type?.toUpperCase() }}
          </div>
          <div>
            <h3 style="margin:0 0 8px">{{ detailRow.title }}</h3>
            <p style="margin:0;color:#909399;font-size:13px">
              上传者：{{ detailRow.uploader_name }}
              <el-divider direction="vertical" />
              分类：{{ detailRow.category_name }}
              <el-divider direction="vertical" />
              大小：{{ detailRow.sizeLabel }}
            </p>
            <p style="margin:4px 0 0;color:#909399;font-size:13px">
              课程：{{ detailRow.course_name || '未指定' }}
              <el-divider direction="vertical" />
              格式：{{ detailRow.file_type?.toUpperCase() }}
            </p>
          </div>
        </div>
        <el-divider />
        <h4 style="margin:0 0 8px">描述</h4>
        <p style="color:#606266;font-size:14px;margin:0 0 16px;min-height:40px">
          {{ detailRow.description || '暂无描述' }}
        </p>
        <div style="display:flex;gap:12px">
          <el-button :icon="'View'" @click="previewFile(detailRow)">在线预览</el-button>
          <el-button :icon="'Download'" @click="downloadFile(detailRow)">下载文件</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Approve dialog with metadata editing -->
    <el-dialog v-model="approveVisible" title="审核通过 — 完善资料信息" width="540px">
      <el-form v-if="approveRow" ref="approveFormRef" :model="approveForm" :rules="approveRules" label-width="100px">
        <el-form-item label="资源标题" prop="title">
          <el-input v-model="approveForm.title" maxlength="100" />
        </el-form-item>
        <el-form-item label="所属课程" prop="course_id">
          <el-select v-model="approveForm.course_id" placeholder="选择课程" filterable clearable style="width:100%">
            <el-option v-for="c in courses" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="资料类型" prop="category_id">
          <el-select v-model="approveForm.category_id" placeholder="选择类型" style="width:100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="approveForm.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
        <el-form-item label="文件预览">
          <div style="display:flex;gap:8px">
            <el-button size="small" :icon="'View'" @click="previewFile(approveRow)">预览</el-button>
            <el-button size="small" :icon="'Download'" @click="downloadFile(approveRow)">下载</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="confirmApprove">确认通过</el-button>
      </template>
    </el-dialog>

    <!-- Reject dialog -->
    <el-dialog v-model="rejectVisible" title="驳回原因" width="400px">
      <el-input v-model="rejectNote" type="textarea" :rows="3" placeholder="请填写驳回原因（选填）" />
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" :loading="submitting" @click="confirmReject">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getAdminResources, reviewResource, updateResource } from '@/api/resourceApi'
import { getAllCourses } from '@/api/courseApi'
import { getCategories } from '@/api/categoryApi'

const resources = ref([])
const courses = ref([])
const categories = ref([])
const loading = ref(false)
const submitting = ref(false)
const page = ref(1)
const total = ref(0)

const detailVisible = ref(false)
const detailRow = ref(null)

const approveVisible = ref(false)
const approveRow = ref(null)
const approveFormRef = ref(null)
const approveForm = reactive({ title: '', course_id: null, category_id: '', description: '' })
const approveRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  category_id: [{ required: true, message: '请选择资料类型', trigger: 'change' }],
}

const rejectVisible = ref(false)
const rejectNote = ref('')
const rejectRow = ref(null)

// --- Load ---
async function loadReviews() {
  loading.value = true
  try {
    const [res, courseRes, catRes] = await Promise.all([
      getAdminResources({ status: 'pending', page: page.value }),
      getAllCourses(),
      getCategories(),
    ])
    resources.value = res.data
    total.value = res.meta?.total || 0
    courses.value = courseRes.data || []
    categories.value = catRes.data || []
  } catch {
    resources.value = []
  } finally {
    loading.value = false
  }
}

function showDetail(row) {
  detailRow.value = row
  detailVisible.value = true
}

function previewFile(row) {
  const token = localStorage.getItem('accessToken')
  window.open(`/api/v1/resources/${row.id}/preview?token=${token}`, '_blank')
}

function downloadFile(row) {
  const token = localStorage.getItem('accessToken')
  window.open(`/api/v1/resources/${row.id}/download?token=${token}`, '_blank')
}

// --- Approve ---
function openApproveDialog(row) {
  approveRow.value = row
  approveForm.title = row.title || ''
  approveForm.course_id = row.course_id || null
  approveForm.category_id = row.category_id || ''
  approveForm.description = row.description || ''
  approveVisible.value = true
}

async function confirmApprove() {
  const valid = await approveFormRef.value.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    // Update metadata first
    if (approveForm.title !== approveRow.value.title ||
        approveForm.course_id !== approveRow.value.course_id ||
        approveForm.category_id !== approveRow.value.category_id ||
        approveForm.description !== (approveRow.value.description || '')) {
      await updateResource(approveRow.value.id, {
        title: approveForm.title,
        course_id: approveForm.course_id || null,
        category_id: approveForm.category_id,
        description: approveForm.description,
      })
    }
    // Then approve
    await reviewResource(approveRow.value.id, { status: 'approved', review_note: '' })
    ElMessage.success('审核通过')
    approveVisible.value = false
    loadReviews()
    window.dispatchEvent(new CustomEvent('review-updated'))
  } catch {
    // handled by interceptor
  } finally {
    submitting.value = false
  }
}

// --- Reject ---
function handleReject(row) {
  rejectRow.value = row
  rejectNote.value = ''
  rejectVisible.value = true
}

async function confirmReject() {
  submitting.value = true
  try {
    await reviewResource(rejectRow.value.id, { status: 'rejected', review_note: rejectNote.value || '' })
    ElMessage.success('已驳回')
    rejectVisible.value = false
    loadReviews()
    window.dispatchEvent(new CustomEvent('review-updated'))
  } catch {
    // handled by interceptor
  } finally {
    submitting.value = false
  }
}

onMounted(loadReviews)
</script>
