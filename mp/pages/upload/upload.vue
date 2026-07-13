<template>
  <view class="container">
    <view class="form-group">
      <text class="label">资源标题</text>
      <input class="input" placeholder="建议格式：[真题] 课程名 年份" v-model="title" />
    </view>

    <view class="form-group">
      <text class="label">所属课程</text>
      <picker :range="courses" range-key="name" @change="onCourseChange">
        <view class="picker">{{ courseName || '选择课程' }}</view>
      </picker>
    </view>

    <view class="form-group">
      <text class="label">资料类型</text>
      <picker :range="categories" range-key="name" @change="onCategoryChange">
        <view class="picker">{{ categoryName || '选择类型' }}</view>
      </picker>
    </view>

    <view class="form-group">
      <text class="label">描述（选填）</text>
      <textarea class="textarea" placeholder="年份、学期、题型说明等" v-model="description" maxlength="500" />
    </view>

    <view class="form-group">
      <text class="label">文件</text>
      <view class="file-uploader" @tap="chooseFile">
        <text v-if="!fileName" class="upload-hint">点击选择文件</text>
        <text v-else class="file-name">{{ fileName }}</text>
      </view>
      <text class="file-tip">支持 PDF、Word、PPT、Excel，最大 50MB</text>
    </view>

    <button class="btn primary" @tap="handleUpload" :disabled="uploading">
      {{ uploading ? '上传中...' : '提交审核' }}
    </button>
  </view>
</template>

<script>
import { getCourses, uploadResource } from '@/utils/api'
const CATS = [
  { id: 1, name: '考试真题' },
  { id: 2, name: '复习资料' },
  { id: 3, name: '其他资料' }
]

export default {
  data() {
    return {
      title: '',
      courseId: '',
      courseName: '',
      categoryId: '',
      categoryName: '',
      description: '',
      fileName: '',
      filePath: '',
      courses: [],
      categories: CATS,
      uploading: false
    }
  },
  onShow() { this.loadCourses() },
  methods: {
    async loadCourses() {
      try {
        const res = await getCourses()
        this.courses = res.data || []
      } catch {}
    },
    onCourseChange(e) {
      const c = this.courses[e.detail.value]
      if (c) { this.courseId = c.id; this.courseName = c.name }
    },
    onCategoryChange(e) {
      const c = this.categories[e.detail.value]
      if (c) { this.categoryId = c.id; this.categoryName = c.name }
    },
    chooseFile() {
      uni.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'],
        success: (res) => {
          const f = res.tempFiles[0]
          this.fileName = f.name
          this.filePath = f.path
        }
      })
    },
    async handleUpload() {
      if (!this.title || !this.courseId || !this.categoryId || !this.filePath) {
        uni.showToast({ title: '请填写完整信息', icon: 'none' }); return
      }
      this.uploading = true
      try {
        await uploadResource({
          title: this.title,
          course_id: this.courseId,
          category_id: this.categoryId,
          description: this.description,
          filePath: this.filePath
        })
        uni.showToast({ title: '上传成功，等待审核' })
        setTimeout(() => {
          this.title = ''; this.courseId = ''; this.courseName = ''
          this.categoryId = ''; this.categoryName = ''
          this.description = ''; this.fileName = ''; this.filePath = ''
        }, 1500)
      } catch (e) { uni.showToast({ title: '上传失败', icon: 'none' }) }
      this.uploading = false
    }
  }
}
</script>

<style>
.container { padding: 16px; }
.form-group { margin-bottom: 16px; }
.label { display: block; font-size: 14px; font-weight: 500; color: #303133; margin-bottom: 6px; }
.input { width: 100%; height: 44px; border: 1px solid #dcdfe6; border-radius: 8px; padding: 0 12px; font-size: 14px; box-sizing: border-box; background: #fff; }
.textarea { width: 100%; min-height: 80px; border: 1px solid #dcdfe6; border-radius: 8px; padding: 10px 12px; font-size: 14px; box-sizing: border-box; background: #fff; }
.picker { width: 100%; height: 44px; line-height: 44px; border: 1px solid #dcdfe6; border-radius: 8px; padding: 0 12px; font-size: 14px; color: #303133; background: #fff; }
.file-uploader { width: 100%; min-height: 80px; border: 2px dashed #dcdfe6; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: #fafafa; }
.upload-hint { color: #909399; font-size: 14px; }
.file-name { color: #303133; font-size: 14px; padding: 10px; }
.file-tip { display: block; margin-top: 6px; font-size: 12px; color: #909399; }
.btn { width: 100%; height: 46px; border-radius: 10px; font-size: 16px; display: flex; align-items: center; justify-content: center; margin-top: 10px; }
.btn.primary { background: #2b6cb0; color: #fff; }
.btn.primary[disabled] { background: #a0c4e8; }
</style>
