<template>
  <div class="page-container">
    <div class="page-title">
      <span>资源管理</span>
    </div>

    <!-- Search & Filter -->
    <div class="search-bar">
      <el-input
        v-model="search"
        placeholder="搜索资源..."
        clearable
        @keyup.enter="loadResources"
        style="width:220px"
      />
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

    <el-table :data="resources" stripe v-loading="loading" @row-click="showDetail">
      <el-table-column type="index" width="50" />
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
      <el-table-column prop="uploader_name" label="上传者" width="120" />
      <el-table-column prop="category_name" label="分类" width="90" />
      <el-table-column prop="file_type" label="格式" width="60">
        <template #default="{ row }">{{ row.file_type?.toUpperCase() }}</template>
      </el-table-column>
      <el-table-column prop="sizeLabel" label="大小" width="80" />
      <el-table-column prop="download_count" label="下载" width="60" align="center" />
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="时间" width="160" />
      <el-table-column label="操作" width="80" fixed="right" @click.stop>
        <template #default="{ row }">
          <el-popconfirm title="确定删除此资源？" @confirm="handleDelete(row)">
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
        @current-change="loadResources"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getAdminResources, deleteResource } from '@/api/resourceApi'
import { getCategories } from '@/api/categoryApi'

const router = useRouter()
const resources = ref([])
const categories = ref([])
const loading = ref(false)
const search = ref('')
const statusFilter = ref('')
const categoryId = ref('')
const page = ref(1)
const total = ref(0)

function statusType(s) {
  return { pending: 'warning', approved: 'success', rejected: 'danger' }[s] || 'info'
}
function statusLabel(s) {
  return { pending: '待审核', approved: '已通过', rejected: '已驳回' }[s] || s
}

async function loadResources() {
  loading.value = true
  try {
    const res = await getAdminResources({
      page: page.value,
      search: search.value,
      status: statusFilter.value,
      category_id: categoryId.value,
    })
    resources.value = res.data
    total.value = res.meta?.total || 0
  } catch {
    resources.value = []
  } finally {
    loading.value = false
  }
}

function showDetail(row) {
  router.push(`/resources/${row.id}`)
}

async function handleDelete(row) {
  try {
    await deleteResource(row.id)
    ElMessage.success('删除成功')
    loadResources()
  } catch {}
}

onMounted(async () => {
  try {
    const res = await getCategories()
    categories.value = res.data
  } catch {}
  loadResources()
})
</script>
