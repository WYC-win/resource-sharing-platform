<template>
  <div class="page-container">
    <div class="page-title">
      <span>公告管理</span>
      <el-button type="primary" :icon="'Plus'" @click="showDialog(null)">
        发布公告
      </el-button>
    </div>

    <el-table :data="announcements" stripe v-loading="loading">
      <el-table-column type="index" label="序号" width="60" />
      <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
      <el-table-column prop="content" label="内容" min-width="260" show-overflow-tooltip />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 'published' ? 'success' : 'info'" size="small">
            {{ row.status === 'published' ? '已发布' : '草稿' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="置顶" width="70" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.is_pinned" type="warning" size="small">置顶</el-tag>
          <span v-else style="color:#909399">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="creator_name" label="发布人" width="110" />
      <el-table-column prop="published_at" label="发布时间" width="170" />
      <el-table-column prop="created_at" label="创建时间" width="170" />
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button text size="small" @click="showDialog(row)">编辑</el-button>
          <el-button
            v-if="row.status === 'draft'"
            text type="success" size="small"
            @click="handlePublish(row)"
          >发布</el-button>
          <el-button
            v-else
            text type="warning" size="small"
            @click="handleUnpublish(row)"
          >下架</el-button>
          <el-button text size="small" @click="handleTogglePin(row)">
            {{ row.is_pinned ? '取消置顶' : '置顶' }}
          </el-button>
          <el-popconfirm title="确定删除此公告？" @confirm="handleDelete(row)">
            <template #reference>
              <el-button text type="danger" size="small">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <!-- Announcement form dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑公告' : '发布公告'"
      width="600px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入公告标题" maxlength="200" />
        </el-form-item>
        <el-form-item label="内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="8"
            placeholder="请输入公告内容"
            maxlength="5000"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          {{ editingId ? '保存' : '发布' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getAdminAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  unpublishAnnouncement,
  togglePinAnnouncement,
} from '@/api/announcementApi'

const announcements = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)
const formRef = ref(null)

const form = reactive({
  title: '',
  content: '',
})

const rules = {
  title: [{ required: true, message: '请输入公告标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入公告内容', trigger: 'blur' }],
}

async function loadAnnouncements() {
  loading.value = true
  try {
    const res = await getAdminAnnouncements({ pageSize: 50 })
    announcements.value = res.items
  } catch {
    announcements.value = []
  } finally {
    loading.value = false
  }
}

function showDialog(row) {
  if (row) {
    editingId.value = row.id
    form.title = row.title
    form.content = row.content
  } else {
    editingId.value = null
    form.title = ''
    form.content = ''
  }
  dialogVisible.value = true
}

async function handleSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    if (editingId.value) {
      await updateAnnouncement(editingId.value, { title: form.title, content: form.content })
      ElMessage.success('公告已更新')
    } else {
      const res = await createAnnouncement({ title: form.title, content: form.content })
      if (res.code === 201) {
        ElMessage.success('公告已创建')
      }
    }
    dialogVisible.value = false
    await loadAnnouncements()
  } catch {
    // Error handled by interceptor
  } finally {
    saving.value = false
  }
}

async function handleDelete(row) {
  try {
    await deleteAnnouncement(row.id)
    ElMessage.success('公告已删除')
    await loadAnnouncements()
  } catch {
    // Error handled by interceptor
  }
}

async function handlePublish(row) {
  try {
    await publishAnnouncement(row.id)
    ElMessage.success('公告已发布')
    await loadAnnouncements()
  } catch {
    // Error handled by interceptor
  }
}

async function handleUnpublish(row) {
  try {
    await unpublishAnnouncement(row.id)
    ElMessage.success('公告已下架')
    await loadAnnouncements()
  } catch {
    // Error handled by interceptor
  }
}

async function handleTogglePin(row) {
  try {
    await togglePinAnnouncement(row.id)
    ElMessage.success(row.is_pinned ? '已取消置顶' : '已置顶')
    await loadAnnouncements()
  } catch {
    // Error handled by interceptor
  }
}

function resetForm() {
  form.title = ''
  form.content = ''
  editingId.value = null
  formRef.value?.resetFields()
}

onMounted(() => {
  loadAnnouncements()
})
</script>
