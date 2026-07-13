<template>
  <view class="container">
    <view v-if="loading" class="loading">加载中...</view>

    <view v-else-if="resource" class="detail">
      <view class="detail-header">
        <view class="file-badge" :class="resource.file_type">{{ resource.file_type?.toUpperCase() }}</view>
        <view class="detail-info">
          <text class="detail-title">{{ resource.title }}</text>
          <text class="detail-meta">
            {{ resource.category_name }} · {{ resource.sizeLabel }} · {{ resource.file_type?.toUpperCase() }}
          </text>
        </view>
      </view>

      <view class="stats-row">
        <view class="stat-item">
          <text class="stat-num">{{ resource.download_count }}</text>
          <text class="stat-label">下载次数</text>
        </view>
      </view>

      <view class="section">
        <text class="section-title">描述</text>
        <text class="section-body">{{ resource.description || '暂无描述' }}</text>
      </view>

      <view class="actions">
        <button class="btn primary" @tap="handlePreview">📄 在线预览</button>
        <button class="btn outline" @tap="handleDownload" :disabled="downloading">⬇️ {{ downloading ? '下载中 ' + progress + '%' : '下载文件' }}</button>
      </view>

      <!-- Progress bar -->
      <view v-if="downloading" class="progress-wrap">
        <view class="progress-bar" :style="'width:' + progress + '%'"></view>
      </view>
    </view>

    <view v-else class="empty">资源不存在</view>
  </view>
</template>

<script>
import { getResourceDetail, previewResource, downloadResource } from '@/utils/api'

export default {
  data() {
    return { resource: null, loading: true, downloading: false, progress: 0 }
  },
  onLoad(query) { this.loadDetail(query.id) },
  methods: {
    async loadDetail(id) {
      this.loading = true
      try {
        const res = await getResourceDetail(id)
        this.resource = res.data
      } catch (e) { this.resource = null }
      this.loading = false
    },
    handlePreview() {
      if (this.resource) previewResource(this.resource.id)
    },
    handleDownload() {
      if (!this.resource) return
      uni.showModal({
        title: '提示',
        content: '文件打开后，点击右上角「…」即可保存或转发',
        showCancel: false,
        success: () => {
          this.downloading = true
          this.progress = 0
          downloadResource(this.resource.id, (p) => {
            this.progress = p
            if (p >= 100) setTimeout(() => { this.downloading = false }, 500)
          })
        }
      })
    }
  }
}
</script>

<style>
.container { padding: 16px; }
.loading { text-align: center; padding: 60px; color: #909399; }
.detail-header { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 16px; }
.file-badge { width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0; }
.file-badge.pdf { background: #f56c6c; }
.file-badge.doc, .file-badge.docx { background: #409eff; }
.file-badge.ppt, .file-badge.pptx, .file-badge.pps { background: #e6a23c; }
.file-badge.xls, .file-badge.xlsx { background: #67c23a; }
.detail-info { flex: 1; }
.detail-title { display: block; font-size: 18px; font-weight: 600; color: #303133; line-height: 1.4; }
.detail-meta { display: block; font-size: 13px; color: #909399; margin-top: 6px; }
.stats-row { display: flex; gap: 20px; margin-bottom: 16px; }
.stat-item { text-align: center; }
.stat-num { display: block; font-size: 22px; font-weight: 700; color: #303133; }
.stat-label { display: block; font-size: 12px; color: #909399; margin-top: 2px; }
.section { background: #fff; border-radius: 10px; padding: 14px; margin-bottom: 16px; }
.section-title { display: block; font-size: 15px; font-weight: 600; color: #303133; margin-bottom: 8px; }
.section-body { display: block; font-size: 14px; color: #606266; line-height: 1.6; }
.actions { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
.btn { width: 100%; height: 46px; border-radius: 10px; font-size: 16px; display: flex; align-items: center; justify-content: center; }
.btn.primary { background: #2b6cb0; color: #fff; }
.btn.outline { background: #fff; color: #2b6cb0; border: 1px solid #2b6cb0; }
.btn.outline[disabled] { border-color: #a0c4e8; color: #a0c4e8; }
.progress-wrap { height: 6px; background: #e4e7ed; border-radius: 3px; margin-top: 12px; overflow: hidden; }
.progress-bar { height: 100%; background: #2b6cb0; border-radius: 3px; transition: width 0.3s ease; }
.empty { text-align: center; padding: 60px; color: #909399; }
</style>
