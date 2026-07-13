<template>
  <view class="container">
    <view class="search-bar">
      <input class="search-input" placeholder="搜索课程..." v-model="search" @input="onSearch" />
    </view>

    <view v-if="loading" class="loading"><text>加载中...</text></view>

    <view v-else class="course-grid">
      <view class="course-card-wrapper" v-for="c in filteredCourses" :key="c.id">
        <view class="course-card" @tap="enterCourse(c)">
          <text class="course-icon">📁</text>
          <text class="course-name">{{ c.name }}</text>
          <text class="course-count">{{ c.count }} 份资料</text>
        </view>
      </view>
    </view>

    <view v-if="!loading && filteredCourses.length === 0" class="empty">
      <text>暂无课程</text>
    </view>
  </view>
</template>

<script>
import { getCourses } from '@/utils/api'

function fuzzyMatch(text, query) {
  if (!query) return true
  let qi = 0
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) qi++
  }
  return qi === query.length
}

export default {
  data() {
    return { courses: [], search: '', loading: true }
  },
  computed: {
    filteredCourses() {
      const q = this.search.trim()
      if (!q) return this.courses
      return this.courses.filter(c => fuzzyMatch(c.name, q))
    }
  },
  onShow() { this.loadCourses() },
  methods: {
    async loadCourses() {
      this.loading = true
      try {
        const res = await getCourses()
        this.courses = res.data || []
      } catch (e) {
        uni.showToast({ title: '加载失败', icon: 'none' })
      }
      this.loading = false
    },
    enterCourse(c) {
      uni.navigateTo({ url: '/pages/resources/resources?course_id=' + c.id + '&name=' + encodeURIComponent(c.name) })
    }
  }
}
</script>

<style>
.container { padding: 10px; }
.search-bar { margin-bottom: 12px; }
.search-input { width: 100%; height: 40px; border-radius: 20px; background: #fff; border: 1px solid #e4e7ed; padding: 0 16px; font-size: 14px; box-sizing: border-box; }
.loading { text-align: center; padding: 60px 0; color: #909399; }
.course-grid { display: flex; flex-wrap: wrap; margin: 0 -4px; }
.course-card-wrapper { width: 50%; padding: 0 4px; box-sizing: border-box; margin-bottom: 8px; }
.course-card { background: #fff; border-radius: 10px; padding: 16px 6px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; flex-direction: column; align-items: center; gap: 4px; }
.course-icon { font-size: 28px; }
.course-name { font-size: 13px; font-weight: 600; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }
.course-count { font-size: 11px; color: #909399; }
.empty { text-align: center; padding: 60px 0; color: #909399; font-size: 14px; }
</style>
