<template>
  <div class="page-container">
    <div class="page-title">
      <span>分类管理</span>
      <el-button type="primary" :icon="'Plus'" @click="showDialog(null)">
        添加分类
      </el-button>
    </div>

    <el-table :data="categories" stripe v-loading="loading">
      <el-table-column type="index" label="排序" width="60" />
      <el-table-column prop="name" label="分类名称" width="200" />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column prop="resourceCount" label="资源数量" width="100" align="center" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button text size="small" @click="showDialog(row)">编辑</el-button>
          <el-popconfirm
            title="确定删除此分类？"
            @confirm="handleDelete(row)"
          >
            <template #reference>
              <el-button text type="danger" size="small">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <!-- Category form dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑分类' : '添加分类'"
      width="460px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：课件、试卷" maxlength="50" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="2" maxlength="200" />
        </el-form-item>
        <el-form-item label="排序" prop="sort_order">
          <el-input-number v-model="form.sort_order" :min="0" :max="999" />
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
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/api/categoryApi'

const categories = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)
const formRef = ref(null)

const form = reactive({
  name: '',
  description: '',
  sort_order: 0,
})

const rules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
}

async function loadCategories() {
  loading.value = true
  try {
    const res = await getCategories()
    categories.value = res.data
  } catch {
    categories.value = []
  } finally {
    loading.value = false
  }
}

function showDialog(row) {
  if (row) {
    editingId.value = row.id
    form.name = row.name
    form.description = row.description || ''
    form.sort_order = row.sort_order || 0
  } else {
    editingId.value = null
    form.name = ''
    form.description = ''
    form.sort_order = 0
  }
  dialogVisible.value = true
}

function resetForm() {
  editingId.value = null
  form.name = ''
  form.description = ''
  form.sort_order = 0
  formRef.value?.resetFields()
}

async function handleSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    if (editingId.value) {
      await updateCategory(editingId.value, { ...form })
      ElMessage.success('分类已更新')
    } else {
      await createCategory({ ...form })
      ElMessage.success('分类已添加')
    }
    dialogVisible.value = false
    loadCategories()
  } catch {
    // handled by interceptor
  } finally {
    saving.value = false
  }
}

async function handleDelete(row) {
  try {
    await deleteCategory(row.id)
    ElMessage.success('分类已删除')
    loadCategories()
  } catch {}
}

onMounted(loadCategories)
</script>
