<template>
  <div class="page-container">
    <div class="page-title">
      <span>实时日志</span>
      <div style="display:flex;gap:8px;align-items:center">
        <el-switch v-model="autoRefresh" active-text="自动刷新" size="small" @change="toggleRefresh" />
        <span style="font-size:12px;color:#909399" v-if="autoRefresh">{{ countdown }}s</span>
        <el-button size="small" :icon="'Refresh'" @click="loadLogs" :loading="loading">刷新</el-button>
      </div>
    </div>

    <div class="log-list" v-loading="loading && logs.length === 0">
      <div v-for="(item, idx) in logs" :key="idx" :class="['log-item', item.type]">
        <div class="log-icon">
          <el-icon v-if="item.type === 'download'" :size="16"><Download /></el-icon>
          <el-icon v-else :size="16"><Position /></el-icon>
        </div>
        <div class="log-body">
          <div class="log-main">
            <template v-if="item.type === 'download'">
              <span class="log-user">{{ item.username }}</span>
              下载了
              <span class="log-title">{{ item.title }}</span>
              <span class="log-type">({{ item.file_type }})</span>
            </template>
            <template v-else>
              <span class="log-user">{{ item.visitor }}</span>
              访问了网站
            </template>
          </div>
          <div class="log-time">{{ item.time }}</div>
        </div>
      </div>
      <div v-if="logs.length === 0 && !loading" class="ma-empty">暂无日志</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import request from '@/api/request'

const logs = ref([])
const loading = ref(false)
const autoRefresh = ref(true)
const countdown = ref(5)
let timer = null
let countdownTimer = null

async function loadLogs() {
  loading.value = true
  try {
    const r = await request.get('/stats/live-log?limit=50')
    logs.value = r.data || []
  } catch { logs.value = [] }
  finally { loading.value = false }
}

function toggleRefresh(val) {
  if (val) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  countdown.value = 5
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) countdown.value = 5
  }, 1000)
  timer = setInterval(() => {
    loadLogs()
    countdown.value = 5
  }, 5000)
}

function stopAutoRefresh() {
  if (timer) { clearInterval(timer); timer = null }
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
}

onMounted(() => {
  loadLogs()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.log-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.log-item {
  display: flex;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #fff;
  border: 1px solid #f0f0f0;
  align-items: flex-start;
}

.log-item.download {
  border-left: 3px solid #67c23a;
}

.log-item.visit {
  border-left: 3px solid #909399;
}

.log-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-top: 1px;
}
.log-item.download .log-icon {
  background: #f0f9eb;
  color: #67c23a;
}
.log-item.visit .log-icon {
  background: #f5f7fa;
  color: #909399;
}

.log-body {
  flex: 1;
  min-width: 0;
}

.log-main {
  font-size: 13px;
  color: #303133;
  line-height: 1.5;
}

.log-user {
  font-weight: 600;
  color: #409eff;
}

.log-title {
  font-weight: 500;
  color: #303133;
}

.log-type {
  font-size: 11px;
  color: #909399;
  text-transform: uppercase;
}

.log-time {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 2px;
}

.ma-empty {
  text-align: center;
  padding: 40px;
  color: #909399;
}
</style>
