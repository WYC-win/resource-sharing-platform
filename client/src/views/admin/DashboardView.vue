<template>
  <div class="page-container">
    <h2 class="page-title" style="border-bottom:none;margin-bottom:16px">仪表盘</h2>

    <!-- Stats cards -->
    <div class="stats-grid" v-loading="loading">
      <div class="stat-card">
        <div class="stat-icon" style="background:#ecf5ff;color:#409eff">
          <el-icon :size="24"><User /></el-icon>
        </div>
        <div class="stat-info">
          <h3>{{ stats.users?.total || 0 }}</h3>
          <p>总用户数（活跃 {{ stats.users?.active || 0 }}）</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#f0f9eb;color:#67c23a">
          <el-icon :size="24"><Files /></el-icon>
        </div>
        <div class="stat-info">
          <h3>{{ stats.resources?.total || 0 }}</h3>
          <p>总资源数（通过 {{ stats.resources?.approved || 0 }}）</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#fdf6ec;color:#e6a23c">
          <el-icon :size="24"><Edit /></el-icon>
        </div>
        <div class="stat-info">
          <h3>{{ stats.resources?.pending || 0 }}</h3>
          <p>待审核</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#fef0f0;color:#f56c6c">
          <el-icon :size="24"><Download /></el-icon>
        </div>
        <div class="stat-info">
          <h3>{{ stats.downloads?.today || 0 }} / {{ stats.downloads?.week || 0 }}</h3>
          <p>今日 / 本周下载</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#f0f5ff;color:#667eea">
          <el-icon :size="24"><Opportunity /></el-icon>
        </div>
        <div class="stat-info">
          <h3>{{ stats.visits?.total || 0 }}</h3>
          <p>总访问量（今日 {{ stats.visits?.today || 0 }}）</p>
        </div>
      </div>
    </div>

    <!-- Recent & Charts -->
    <el-row :gutter="20">
      <el-col :xs="24" :lg="14">
        <el-card>
          <template #header>最近上传</template>
          <el-table :data="recent" size="small" v-loading="loading" max-height="400">
            <el-table-column prop="title" label="资源" min-width="160" show-overflow-tooltip />
            <el-table-column prop="uploader_name" label="上传者" width="120" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)" size="small">
                  {{ statusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="时间" width="160" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="10">
        <el-card>
          <template #header>分类分布</template>
          <div v-if="chartData.length > 0" style="height:360px" ref="chartRef" />
          <div v-else style="height:300px;display:flex;align-items:center;justify-content:center;color:#909399">
            暂无数据
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'
import request from '@/api/request'
import * as echarts from 'echarts'

const loading = ref(false)
const stats = ref({})
const recent = ref([])
const chartRef = ref(null)
const chartData = ref([])

function statusType(s) {
  return { pending: 'warning', approved: 'success', rejected: 'danger' }[s] || 'info'
}
function statusLabel(s) {
  return { pending: '待审核', approved: '已通过', rejected: '已驳回' }[s] || s
}

async function loadData() {
  loading.value = true
  try {
    const [overviewRes, recentRes, distRes] = await Promise.all([
      request.get('/stats/overview'),
      request.get('/stats/recent?limit=10'),
      request.get('/stats/category-distribution'),
    ])
    stats.value = overviewRes.data || {}
    recent.value = recentRes.data || []
    chartData.value = distRes.data || []
  } catch {
    // silent
  } finally {
    loading.value = false
  }
}

function initChart() {
  if (!chartRef.value || chartData.value.length === 0) return
  const chart = echarts.init(chartRef.value)
  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    series: [{
      type: 'pie',
      radius: ['35%', '60%'],
      center: ['50%', '45%'],
      data: chartData.value.map(d => ({ name: d.name, value: d.count })),
      label: {
        show: true,
        formatter: '{b}\n{c}',
        fontSize: 13,
      },
      labelLine: { length: 15, length2: 10 },
    }],
  })
}

watch(chartData, () => {
  nextTick(initChart)
})

onMounted(async () => {
  await loadData()
  nextTick(initChart)
})
</script>
