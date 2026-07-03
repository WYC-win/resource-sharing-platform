<template>
  <div class="page-container">
    <div class="page-title">
      <span>课程管理</span>
      <el-button type="primary" :icon="'Plus'" @click="showDialog(null)">
        添加课程
      </el-button>
    </div>

    <el-table :data="courses" stripe v-loading="loading">
      <el-table-column type="index" label="序号" width="60" />
      <el-table-column prop="name" label="课程名称" min-width="200" />
      <el-table-column prop="count" label="资源数量" width="100" align="center" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button text size="small" @click="showDialog(row)">编辑</el-button>
          <el-popconfirm
            title="确定删除此课程？该课程下的资源不会自动删除，需要先迁移或删除资源"
            @confirm="handleDelete(row)"
          >
            <template #reference>
              <el-button text type="danger" size="small">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <!-- Course form dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑课程' : '添加课程'"
      width="460px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="课程名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：高等数学（上）" maxlength="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          {{ editingId ? '保存' : '添加' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getCourses, createCourse, updateCourse, deleteCourse } from '@/api/courseApi'

const courses = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)
const formRef = ref(null)

const form = reactive({
  name: '',
})

const rules = {
  name: [{ required: true, message: '请输入课程名称', trigger: 'blur' }],
}

async function loadCourses() {
  loading.value = true
  try {
    const res = await getCourses()
    courses.value = res.data
  } catch {
    courses.value = []
  } finally {
    loading.value = false
  }
}

function showDialog(row) {
  if (row) {
    editingId.value = row.id
    form.name = row.name
  } else {
    editingId.value = null
    form.name = ''
  }
  dialogVisible.value = true
}

async function handleSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    if (editingId.value) {
      await updateCourse(editingId.value, { name: form.name })
      ElMessage.success('课程已更新')
    } else {
      await createCourse({ name: form.name })
      ElMessage.success('课程已添加')
    }
    dialogVisible.value = false
    await loadCourses()
  } catch {
    // Error handled by interceptor
  } finally {
    saving.value = false
  }
}

async function handleDelete(row) {
  try {
    const res = await deleteCourse(row.id)
    if (res.code === 200) {
      ElMessage.success('课程已删除')
      await loadCourses()
    } else {
      ElMessage.warning(res.message)
    }
  } catch {
    // Error handled by interceptor
  }
}

function resetForm() {
  form.name = ''
  editingId.value = null
  formRef.value?.resetFields()
}

onMounted(() => {
  loadCourses()
})
</script>
