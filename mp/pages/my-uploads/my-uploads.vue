<template>
  <view class="container">
    <!-- User info card -->
    <view class="user-card">
      <view class="user-avatar">📖</view>
      <view class="user-info">
        <text class="user-sid">{{ user.username }}</text>
        <text class="user-role">学生</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">我的上传</text>
    </view>

    <view v-if="loading" class="loading">加载中...</view>

    <view v-else class="list">
      <view class="item" v-for="item in uploads" :key="item.id">
        <view class="item-top">
          <text class="item-title">{{ item.title }}</text>
          <text :class="['item-status', item.status]">{{ statusText(item.status) }}</text>
        </view>
        <text class="item-meta">{{ item.category_name }} · {{ item.created_at?.slice(0, 10) }}</text>
        <text v-if="item.status === 'rejected' && item.review_note" class="item-note">驳回原因：{{ item.review_note }}</text>
      </view>
    </view>

    <view v-if="!loading && uploads.length === 0" class="empty">暂无上传记录</view>

    <button class="btn logout" @tap="handleLogout">退出登录</button>
  </view>
</template>

<script>
import { getMyUploads } from '@/utils/api'
export default {
  data() { return { uploads: [], loading: true } },
  computed: {
    user() { return JSON.parse(uni.getStorageSync('user') || '{}') }
  },
  onShow() { this.loadUploads() },
  methods: {
    async loadUploads() {
      this.loading = true
      try {
        const res = await getMyUploads({ page: 1, pageSize: 50 })
        this.uploads = res.data || []
      } catch { this.uploads = [] }
      this.loading = false
    },
    statusText(s) { return { pending: '待审核', approved: '已通过', rejected: '已驳回' }[s] || s },
    handleLogout() {
      uni.showModal({
        title: '提示', content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            uni.removeStorageSync('accessToken')
            uni.removeStorageSync('refreshToken')
            uni.removeStorageSync('user')
            uni.reLaunch({ url: '/pages/index/index' })
          }
        }
      })
    }
  }
}
</script>

<style>
.container { padding: 12px; }
.user-card { display: flex; align-items: center; gap: 14px; background: #fff; border-radius: 12px; padding: 18px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
.user-avatar { width: 48px; height: 48px; border-radius: 50%; background: #ebf4ff; display: flex; align-items: center; justify-content: center; font-size: 24px; }
.user-info { flex: 1; }
.user-sid { display: block; font-size: 16px; font-weight: 600; color: #303133; }
.user-role { display: block; font-size: 13px; color: #909399; margin-top: 2px; }
.section { margin-bottom: 10px; }
.section-title { font-size: 16px; font-weight: 600; color: #303133; }
.loading { text-align: center; padding: 40px; color: #909399; }
.list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.item { background: #fff; border-radius: 10px; padding: 14px; }
.item-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
.item-title { font-size: 14px; font-weight: 500; color: #303133; flex: 1; width: 0; }
.item-status { font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 4px; flex-shrink: 0; }
.item-status.pending { background: #fdf6ec; color: #e6a23c; }
.item-status.approved { background: #f0f9eb; color: #67c23a; }
.item-status.rejected { background: #fef0f0; color: #f56c6c; }
.item-meta { display: block; font-size: 12px; color: #909399; margin-top: 4px; }
.item-note { display: block; font-size: 12px; color: #f56c6c; margin-top: 6px; padding: 6px 8px; background: #fef0f0; border-radius: 4px; }
.btn { width: 100%; height: 44px; border-radius: 10px; font-size: 15px; display: flex; align-items: center; justify-content: center; }
.btn.logout { background: #fff; color: #f56c6c; border: 1px solid #f56c6c; margin-top: 12px; }
.empty { text-align: center; padding: 40px; color: #909399; }
</style>
