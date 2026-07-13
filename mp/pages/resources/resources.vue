<template>
  <view class="container">
    <view class="page-title">
      <text class="back" @tap="goBack">← 课程目录</text>
      <text class="title-text">{{ courseName }}</text>
    </view>

    <view class="search-bar">
      <input class="search-input" placeholder="搜索资源..." v-model="search" @confirm="loadResources" />
      <picker class="filter-picker" :range="categories" range-key="name" @change="onCategoryChange">
        <view class="filter-btn">{{ currentCategoryName || '全部类型' }}</view>
      </picker>
    </view>

    <view v-if="loading" class="loading">加载中...</view>

    <view v-else class="resource-list">
      <view class="resource-card" v-for="item in resources" :key="item.id" @tap="goDetail(item)">
        <view class="file-badge" :class="item.file_type">{{ item.file_type?.toUpperCase() }}</view>
        <view class="resource-info">
          <text class="resource-title">{{ item.title }}</text>
          <text class="resource-meta">{{ item.category_name }} · {{ item.sizeLabel }}</text>
        </view>
      </view>
    </view>

    <view v-if="!loading && resources.length === 0" class="empty">暂无资源</view>
  </view>
</template>

<script>
import { getResources } from '@/utils/api'

export default {
  data() {
    return {
      courseId: '',
      courseName: '',
      resources: [],
      categories: [],
      search: '',
      categoryId: '',
      loading: true,
      page: 1,
      pageSize: 24,
      total: 0
    }
  },
  computed: {
    currentCategoryName() {
      const c = this.categories.find(x => x.id === this.categoryId)
      return c ? c.name : ''
    }
  },
  onLoad(query) {
    this.courseId = query.course_id
    this.courseName = decodeURIComponent(query.name || '')
    uni.setNavigationBarTitle({ title: this.courseName || '资源列表' })
  },
  onShow() { this.loadResources() },
  methods: {
    async loadResources() {
      this.loading = true
      try {
        const res = await getResources({
          page: this.page, pageSize: this.pageSize,
          search: this.search, category_id: this.categoryId,
          course_id: this.courseId
        })
        this.resources = res.data || []
        this.total = res.meta?.total || 0
        // Extract categories from resources
        const cats = []
        const seen = new Set()
        for (const r of this.resources) {
          if (r.category_id && !seen.has(r.category_id)) {
            seen.add(r.category_id)
            cats.push({ id: r.category_id, name: r.category_name })
          }
        }
        this.categories = cats
      } catch (e) { this.resources = [] }
      this.loading = false
    },
    onCategoryChange(e) {
      this.categoryId = this.categories[e.detail.value]?.id || ''
      this.loadResources()
    },
    goDetail(item) {
      uni.navigateTo({ url: '/pages/resource-detail/resource-detail?id=' + item.id })
    },
    goBack() { uni.navigateBack() }
  }
}
</script>

<style>
.container { padding: 18px 12px 12px; }
.page-title { margin-bottom: 10px; }
.back { font-size: 14px; color: #409eff; }
.title-text { display: block; font-size: 18px; font-weight: 600; color: #303133; margin-top: 4px; }
.search-bar { display: flex; gap: 8px; margin-bottom: 12px; }
.search-input { flex: 1; height: 38px; border-radius: 8px; background: #fff; border: 1px solid #e4e7ed; padding: 0 12px; font-size: 14px; }
.filter-btn { height: 38px; line-height: 38px; padding: 0 14px; border-radius: 8px; background: #fff; border: 1px solid #e4e7ed; font-size: 13px; color: #606266; }
.filter-picker { flex-shrink: 0; }
.loading { text-align: center; padding: 60px; color: #909399; }
.resource-list { display: flex; flex-direction: column; gap: 8px; }
.resource-card {
  display: flex; align-items: center; gap: 12px; background: #fff;
  border-radius: 10px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);
}
.file-badge {
  width: 40px; height: 40px; border-radius: 8px; display: flex;
  align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.file-badge.pdf { background: #f56c6c; }
.file-badge.doc, .file-badge.docx { background: #409eff; }
.file-badge.ppt, .file-badge.pptx, .file-badge.pps { background: #e6a23c; }
.file-badge.xls, .file-badge.xlsx { background: #67c23a; }
.resource-info { flex: 1; min-width: 0; }
.resource-title { display: block; font-size: 14px; font-weight: 500; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.resource-meta { display: block; font-size: 12px; color: #909399; margin-top: 4px; }
.empty { text-align: center; padding: 60px; color: #909399; }
</style>
