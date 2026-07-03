import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

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

function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb)
}

request.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config

    // Token expired - try refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        // No refresh token, redirect to login
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        router.push('/login')
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Wait for the refresh to complete
        return new Promise((resolve) => {
          addRefreshSubscriber((token) => {
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

        onRefreshed(accessToken)
        isRefreshing = false

        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return request(originalRequest)
      } catch {
        isRefreshing = false
        refreshSubscribers = []
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        router.push('/login')
        return Promise.reject(error)
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
