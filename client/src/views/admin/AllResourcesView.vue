<template>
  <div class="page-container">
    <div class="page-title">
      <span>资源管理</span>
      <el-button type="primary" :icon="'Upload'" @click="showUpload = true">上传资料</el-button>
    </div>

    <!-- Search & Filter -->
    <div class="search-bar">
      <el-input v-model="search" placeholder="搜索资源..." clearable @keyup.enter="loadResources" style="width:220px" />
      <el-select v-model="statusFilter" placeholder="状态" clearable @change="loadResources">
        <el-option label="待审核" value="pending" />
        <el-option label="已通过" value="approved" />
        <el-option label="已驳回" value="rejected" />
      </el-select>
      <el-select v-model="categoryId" placeholder="分类" clearable @change="loadResources">
        <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
      </el-select>
      <el-button :icon="'Search'" @click="loadResources">搜索</el-button>
    </div>

    <el-table :data="resources" stripe v-loading="loading">
      <el-table-column type="index" width="50" />
      <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
      <el-table-column prop="course_name" label="课程" width="120" show-overflow-tooltip />
      <el-table-column prop="category_name" label="分类" width="80" />
      <el-table-column prop="file_type" label="格式" width="60">
        <template #default="{ row }">{{ row.file_type?.toUpperCase() }}</template>
      </el-table-column>
      <el-table-column prop="sizeLabel" label="大小" width="80" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="visibleType(row)" size="small">{{ visibleLabel(row) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="230" fixed="right" @click.stop>
        <template #default="{ row }">
          <el-button text size="small" @click.stop="openEdit(row)">编辑</el-button>
          <el-button
            v-if="row.status === 'approved' && row.is_visible !== 0"
            text type="warning" size="small"
            @click.stop="handleUnpublish(row)"
          >下架</el-button>
          <el-button
            v-if="row.is_visible === 0"
            text type="success" size="small"
            @click.stop="handleRepublish(row)"
          >上架</el-button>
          <el-popconfirm title="确定删除？" @confirm="handleDelete(row)">
            <template #reference>
              <el-button text type="danger" size="small">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > 0" style="text-align:center;margin-top:20px">
      <el-pagination
        v-model:current-page="page" :page-size="20" :total="total"
        layout="total, prev, pager, next" @current-change="loadResources"
      />
    </div>

    <!-- Edit dialog -->
    <el-dialog v-model="editVisible" title="编辑资源" width="520px">
      <el-form v-if="editRow" ref="editFormRef" :model="editForm" :rules="editRules" label-width="100px">
        <el-form-item label="资源标题" prop="title">
          <el-input v-model="editForm.title" maxlength="100" />
        </el-form-item>
        <el-form-item label="所属课程">
          <el-select v-model="editForm.course_id" placeholder="选择课程" filterable clearable style="width:100%">
            <el-option v-for="c in courses" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="资料类型">
          <el-select v-model="editForm.category_id" placeholder="选择类型" style="width:100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="文件">
          <div style="display:flex;gap:8px">
            <el-button size="small" @click="previewFile(editRow)">预览</el-button>
            <el-button size="small" @click="downloadFile(editRow)">下载</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- Upload dialog (reuse existing component) -->
    <UploadDialog v-model:visible="showUpload" @success="loadResources" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getAdminResources, deleteResource, updateResource, unpublishResource, republishResource } from '@/api/resourceApi'
import { getCategories } from '@/api/categoryApi'
import { getAllCourses } from '@/api/courseApi'
import UploadDialog from '@/components/resource/UploadDialog.vue'

const resources = ref([])
const categories = ref([])
const courses = ref([])
const loading = ref(false)
const saving = ref(false)
const search = ref('')
const statusFilter = ref('')
const categoryId = ref('')
const page = ref(1)
const total = ref(0)
const showUpload = ref(false)

// Edit dialog
const editVisible = ref(false)
const editRow = ref(null)
const editFormRef = ref(null)
const editForm = reactive({ title: '', course_id: null, category_id: '' })
const editRules = { title: [{ required: true, message: '请输入标题', trigger: 'blur' }] }

function statusType(s) {
  return { pending: 'warning', approved: 'success', rejected: 'danger' }[s] || 'info'
}
function statusLabel(s) {
  return { pending: '待审核', approved: '已通过', rejected: '已驳回' }[s] || s
}
function visibleType(row) {
  if (row.is_visible === 0) return 'danger'
  return row.status === 'approved' ? 'success' : 'warning'
}
function visibleLabel(row) {
  if (row.is_visible === 0) return '已下架'
  return { pending: '待审核', approved: '已上架', rejected: '已驳回' }[row.status] || row.status
}

async function loadResources() {
  loading.value = true
  try {
    const res = await getAdminResources({
      page: page.value, search: search.value,
      status: statusFilter.value, category_id: categoryId.value,
    })
    resources.value = res.data
    total.value = res.meta?.total || 0
  } catch { resources.value = [] }
  finally { loading.value = false }
}

function openEdit(row) {
  editRow.value = row
  editForm.title = row.title || ''
  editForm.course_id = row.course_id || null
  editForm.category_id = row.category_id || ''
  editVisible.value = true
}

async function confirmEdit() {
  const valid = await editFormRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    await updateResource(editRow.value.id, {
      title: editForm.title,
      course_id: editForm.course_id || null,
      category_id: editForm.category_id,
    })
    ElMessage.success('已更新')
    editVisible.value = false
    loadResources()
  } catch {} finally { saving.value = false }
}

function previewFile(row) {
  const token = localStorage.getItem('accessToken')
  window.open(`/api/v1/resources/${row.id}/preview?token=${token}`, '_blank')
}

function downloadFile(row) {
  const token = localStorage.getItem('accessToken')
  window.open(`/api/v1/resources/${row.id}/download?token=${token}`, '_blank')
}

async function handleDelete(row) {
  try {
    await deleteResource(row.id)
    ElMessage.success('删除成功')
    loadResources()
  } catch {}
}

async function handleUnpublish(row) {
  try {
    await unpublishResource(row.id)
    ElMessage.success('已下架')
    loadResources()
  } catch {}
}

async function handleRepublish(row) {
  try {
    await republishResource(row.id)
    ElMessage.success('已重新上架')
    loadResources()
  } catch {}
}

onMounted(async () => {
  try {
    const [catRes, courseRes] = await Promise.all([getCategories(), getAllCourses()])
    categories.value = catRes.data
    courses.value = courseRes.data
  } catch {}
  loadResources()
})
</script>
