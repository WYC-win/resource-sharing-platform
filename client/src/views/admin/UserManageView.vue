<template>
  <div class="page-container">
    <div class="page-title">
      <span>用户管理</span>
      <el-button type="primary" :icon="'Plus'" @click="showCreate = true">
        创建用户
      </el-button>
    </div>

    <el-table :data="users" stripe v-loading="loading">
      <el-table-column prop="username" label="用户名" width="120" />
      <el-table-column prop="display_name" label="姓名" width="120" />
      <el-table-column prop="role" label="角色" width="80">
        <template #default="{ row }">
          <el-tag :type="row.role === 'admin' ? 'danger' : 'primary'" size="small">
            {{ row.role === 'admin' ? '管理员' : '学生' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
            {{ row.status === 'active' ? '正常' : '已禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="170" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button text size="small" @click="handleResetPassword(row)">重置密码</el-button>
          <el-button
            text
            :type="row.status === 'active' ? 'warning' : 'success'"
            size="small"
            @click="handleToggleStatus(row)"
          >
            {{ row.status === 'active' ? '禁用' : '启用' }}
          </el-button>
          <el-popconfirm title="确定删除此用户？" @confirm="handleDelete(row)">
            <template #reference>
              <el-button text type="danger" size="small">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > 0" style="text-align:center;margin-top:20px">
      <el-pagination
        v-model:current-page="page"
        :page-size="20"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="loadUsers"
      />
    </div>

    <!-- Create user dialog -->
    <el-dialog v-model="showCreate" title="创建用户" width="460px" @close="resetCreateForm">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="createForm.username" placeholder="建议使用学号" />
        </el-form-item>
        <el-form-item label="姓名" prop="display_name">
          <el-input v-model="createForm.display_name" placeholder="真实姓名" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-radio-group v-model="createForm.role">
            <el-radio value="student">学生</el-radio>
            <el-radio value="admin">管理员</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getUsers, createUser, updateUser, deleteUser, resetPassword } from '@/api/userApi'

const users = ref([])
const loading = ref(false)
const creating = ref(false)
const showCreate = ref(false)
const page = ref(1)
const total = ref(0)
const createFormRef = ref(null)

const createForm = reactive({
  username: '',
  display_name: '',
  role: 'student',
})

const createRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 50, message: '用户名长度 2-50 位', trigger: 'blur' },
  ],
  display_name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
}

async function loadUsers() {
  loading.value = true
  try {
    const res = await getUsers({ page: page.value })
    users.value = res.data
    total.value = res.meta?.total || 0
  } catch {
    users.value = []
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  const valid = await createFormRef.value.validate().catch(() => false)
  if (!valid) return

  creating.value = true
  try {
    const res = await createUser({ ...createForm })
    ElMessage.success('用户创建成功')
    showCreate.value = false
    loadUsers()

    // Show initial password
    ElMessageBox.alert(
      `<p>用户名：<strong>${res.data.username}</strong></p>
       <p>初始密码：<strong>${res.data.initialPassword}</strong></p>
       <p style="color:#909399;font-size:12px;margin-top:8px">请务必告诉该用户！此密码仅在此显示一次。</p>`,
      '用户创建成功',
      { dangerouslyUseHTMLString: true, confirmButtonText: '已记录' }
    )
  } catch {
    // handled by interceptor
  } finally {
    creating.value = false
  }
}

function resetCreateForm() {
  createForm.username = ''
  createForm.display_name = ''
  createForm.role = 'student'
  createFormRef.value?.resetFields()
}

async function handleResetPassword(row) {
  try {
    const res = await resetPassword(row.id)
    ElMessageBox.alert(
      `<p>用户名：<strong>${row.username}</strong></p>
       <p>新密码：<strong>${res.data.newPassword}</strong></p>
       <p style="color:#909399;font-size:12px;margin-top:8px">此密码仅在此显示一次。</p>`,
      '密码已重置',
      { dangerouslyUseHTMLString: true, confirmButtonText: '已记录' }
    )
  } catch {}
}

async function handleToggleStatus(row) {
  const newStatus = row.status === 'active' ? 'disabled' : 'active'
  const label = newStatus === 'disabled' ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定要${label}用户「${row.display_name}」吗？`, '确认', {
      confirmButtonText: label,
      cancelButtonText: '取消',
      type: 'warning',
    })
    await updateUser(row.id, { status: newStatus })
    ElMessage.success(`已${label}`)
    loadUsers()
  } catch {}
}

async function handleDelete(row) {
  try {
    await deleteUser(row.id)
    ElMessage.success('删除成功')
    loadUsers()
  } catch {}
}

onMounted(loadUsers)
</script>
