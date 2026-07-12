<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <img src="/cugb-badge.png" class="school-badge" alt="校徽" />
        <h2>📖 北地书阁</h2>
        <p class="login-desc">中国地质大学（北京）学习资料分享站</p>
        <p class="school-motto">艰苦朴素 &nbsp; 求真务实</p>
      </div>

      <!-- Tab switch: Student / Admin -->
      <el-tabs v-model="activeTab" :stretch="true" class="login-tabs">
        <el-tab-pane label="学生登录" name="student">
          <el-form
            ref="studentFormRef"
            :model="studentForm"
            :rules="studentRules"
            label-width="0"
            size="large"
            @submit.prevent
            @keyup.enter="handleStudentLogin"
          >
            <el-form-item prop="studentId">
              <el-input
                v-model="studentForm.studentId"
                placeholder="学号"
                maxlength="10"
                :prefix-icon="'CreditCard'"
              />
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                native-type="button"
                :loading="loading"
                class="login-btn"
                @click="handleStudentLogin"
              >
                {{ loading ? '验证中...' : '验证学号' }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="管理员登录" name="admin">
          <el-form
            ref="adminFormRef"
            :model="adminForm"
            :rules="adminRules"
            label-width="0"
            size="large"
            @submit.prevent
            @keyup.enter="handleAdminLogin"
          >
            <el-form-item prop="username">
              <el-input
                v-model="adminForm.username"
                placeholder="用户名"
                :prefix-icon="'User'"
              />
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                v-model="adminForm.password"
                type="password"
                placeholder="密码"
                :prefix-icon="'Lock'"
                show-password
              />
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                :loading="loading"
                class="login-btn"
                @click="handleAdminLogin"
              >
                {{ loading ? '登录中...' : '登 录' }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <div class="login-footer">
        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      </div>
    </div>
    <div class="login-site-footer">
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">冀ICP备2026007969号-2</a>
      <span class="footer-divider-desktop">|</span>
      <span class="desktop-emoji">🐚 </span>已运行 {{ runtime }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const activeTab = ref('student')
const studentFormRef = ref(null)
const adminFormRef = ref(null)
const loading = ref(false)
const errorMsg = ref('')

const startDate = new Date('2026-07-10T00:00:00')
const now = ref(Date.now())
let timer = null
const runtime = computed(() => {
  const diff = Math.floor((now.value - startDate.getTime()) / 1000)
  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  const seconds = diff % 60
  return `${days} 天 ${hours} 小时 ${minutes} 分 ${seconds} 秒`
})
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

// --- Student form ---
const studentForm = reactive({
  studentId: '',
})

const studentRules = {
  studentId: [
    { required: true, message: '请输入学号', trigger: 'blur' },
    { pattern: /^\d{10}$/, message: '学号错误', trigger: 'blur' },
  ],
}

// --- Admin form ---
const adminForm = reactive({
  username: '',
  password: '',
})

const adminRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

// --- Handlers ---
async function handleStudentLogin() {
  const valid = await studentFormRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  errorMsg.value = ''

  try {
    await authStore.studentLogin(studentForm.studentId)
    ElMessage.success('登录成功')
    const redirect = route.query.redirect
    router.push(redirect || '/resources')
  } catch (err) {
    errorMsg.value = err.response?.data?.message || '学号验证失败'
  } finally {
    loading.value = false
  }
}

async function handleAdminLogin() {
  const valid = await adminFormRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  errorMsg.value = ''

  try {
    await authStore.login({
      username: adminForm.username,
      password: adminForm.password,
    })
    ElMessage.success('登录成功')
    const redirect = route.query.redirect
    if (redirect) {
      router.push(redirect)
    } else {
      router.push('/admin/dashboard')
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || '登录失败，请检查用户名和密码'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2b6cb0 0%, #4299e1 50%, #63b3ed 100%);
  padding: 20px;
}

.login-card {
  width: 420px;
  max-width: 100%;
  background: #fff;
  border-radius: 16px;
  padding: 40px 36px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.login-header {
  text-align: center;
  margin-bottom: 24px;
}

.school-badge {
  width: 72px;
  height: 72px;
  margin-bottom: 12px;
}

.login-header h2 {
  font-size: 24px;
  color: #303133;
  margin: 0 0 6px 0;
}

.login-desc {
  color: #909399;
  font-size: 14px;
  margin: 0 0 6px 0;
}

.school-motto {
  color: #2b6cb0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 2px;
  margin: 8px 0 0 0;
  font-family: "KaiTi", "STKaiti", serif;
}

.login-tabs {
  margin-bottom: 8px;
}

.login-btn {
  width: 100%;
}

.login-footer {
  text-align: center;
  margin-top: 8px;
}

.error-msg {
  color: #f56c6c;
  font-size: 13px;
}

.login-site-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  text-align: center;
  padding: 12px 20px;
  font-size: 13px;
  color: rgba(255,255,255,0.7);
}
.login-site-footer a {
  color: rgba(255,255,255,0.7);
  text-decoration: none;
}
.login-site-footer a:hover {
  color: rgba(255,255,255,0.9);
}
.footer-divider-desktop {
  margin: 0 10px;
  color: rgba(255,255,255,0.4);
}

/* Mobile */
@media (max-width: 480px) {
  .login-card {
    padding: 28px 20px;
    border-radius: 12px;
  }
  .school-badge {
    width: 60px;
    height: 60px;
  }
  .login-header h2 {
    font-size: 20px;
  }
  .login-site-footer {
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: center;
  }
  .footer-divider-desktop {
    display: none;
  }
  .desktop-emoji {
    display: none;
  }
}
</style>
