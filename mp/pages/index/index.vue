<template>
  <view class="login-page">
    <view class="login-card">
      <view class="login-header">
        <text class="title">📖 北地书阁</text>
        <text class="desc">学习资料分享站</text>
      </view>

      <view class="form">
        <input class="input" type="text" maxlength="10" placeholder="学号" v-model="studentId" @input="onInput" />
        <button class="btn primary" @tap="handleStudentLogin" :disabled="loading">
          {{ loading ? '验证中...' : '验证学号' }}
        </button>
      </view>

      <view class="footer">
        <text v-if="errorMsg" class="error">{{ errorMsg }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { studentLogin as apiStudentLogin, saveLoginData } from '@/utils/api'

export default {
  data() {
    return { studentId: '', loading: false, errorMsg: '' }
  },
  onLoad() {
    const token = uni.getStorageSync('accessToken')
    if (token) uni.reLaunch({ url: '/pages/courses/courses' })
  },
  methods: {
    onInput(e) { this.studentId = e.detail.value.replace(/\D/g, '') },
    async handleStudentLogin() {
      if (!this.studentId || this.studentId.length !== 10) { this.errorMsg = '学号错误'; return }
      this.loading = true; this.errorMsg = ''
      try {
        const res = await apiStudentLogin(this.studentId)
        saveLoginData(res.data)
        uni.reLaunch({ url: '/pages/courses/courses' })
      } catch (e) { this.errorMsg = e?.message || '学号验证失败' }
      finally { this.loading = false }
    }
  }
}
</script>

<style>
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #2b6cb0, #4299e1, #63b3ed); padding: 12px 30px; }
.login-card { width: 100%; max-width: 400px; background: #fff; border-radius: 16px; padding: 36px 30px; box-shadow: 0 8px 30px rgba(0,0,0,0.15); margin-top: -50rpx; }
.login-header { text-align: center; margin-bottom: 28px; }
.title { font-size: 24px; font-weight: 700; color: #303133; }
.desc { display: block; margin-top: 8px; font-size: 14px; color: #909399; }
.input { width: 100%; height: 44px; border: 1px solid #dcdfe6; border-radius: 8px; padding: 0 14px; font-size: 15px; margin-bottom: 14px; box-sizing: border-box; }
.btn { width: 100%; height: 44px; border-radius: 8px; font-size: 16px; display: flex; align-items: center; justify-content: center; }
.btn.primary { background: #2b6cb0; color: #fff; }
.btn.primary[disabled] { background: #a0c4e8; }
.footer { text-align: center; margin-top: 12px; }
.error { color: #f56c6c; font-size: 13px; }
</style>
