import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { useAuthStore } from '@/stores/authStore'

const request = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - attach JWT token
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle errors, auto-refresh token
let isRefreshing = false
let refreshSubscribers = []

function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

function onRefreshFailed(err) {
  refreshSubscribers.forEach((cb) => cb && cb(null, err))
  refreshSubscribers = []
}

function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb)
}

/**
 * Force logout and sync the Pinia auth store.
 * Keeps `authStore.isLoggedIn` consistent with localStorage so the
 * router guard redirects to /login instead of bouncing back to the
 * main page (the "no login page shown" bug).
 */
function forceLogout() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  try {
    const authStore = useAuthStore()
    authStore.logout()
  } catch {
    // Pinia not initialized yet (e.g. during app bootstrap) - ignore
  }
}

request.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config

    // Token expired - try refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        // No refresh token, force logout and redirect to login
        forceLogout()
        router.push('/login')
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Wait for the refresh to complete (resolved or rejected)
        return new Promise((resolve, reject) => {
          addRefreshSubscriber((token, refreshErr) => {
            if (refreshErr) {
              reject(refreshErr)
              return
            }
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(request(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const res = await axios.post('/api/v1/auth/refresh', { refreshToken })
        const { accessToken, refreshToken: newRefreshToken } = res.data.data

        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', newRefreshToken)

        // Sync the auth store so isLoggedIn reflects the fresh token
        try {
          const authStore = useAuthStore()
          authStore.token = accessToken
          authStore.refreshTokenValue = newRefreshToken
        } catch {}

        onRefreshed(accessToken)
        isRefreshing = false

        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return request(originalRequest)
      } catch (refreshError) {
        isRefreshing = false
        // Wake up every queued request so none of them hang forever
        onRefreshFailed(refreshError)
        forceLogout()
        router.push('/login')
        return Promise.reject(refreshError)
      }
    }

    // Show error message for common status codes
    const msg = error.response?.data?.message || '请求失败，请稍后重试'
    if (error.response?.status !== 401) {
      ElMessage.error(msg)
    }

    return Promise.reject(error)
  }
)

export default request
