import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, studentLogin as studentLoginApi, getProfile } from '@/api/authApi'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const token = ref(localStorage.getItem('accessToken') || '')
  const refreshTokenValue = ref(localStorage.getItem('refreshToken') || '')
  const loading = ref(false)

  // Getters
  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const displayName = computed(() => user.value?.display_name || '')
  const username = computed(() => user.value?.username || '')

  // Actions
  async function login(credentials) {
    loading.value = true
    try {
      const res = await loginApi(credentials)
      const { accessToken, refreshToken, user: userData } = res.data

      token.value = accessToken
      refreshTokenValue.value = refreshToken
      user.value = userData

      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      localStorage.setItem('user', JSON.stringify(userData))

      return userData
    } finally {
      loading.value = false
    }
  }

  async function studentLogin(studentId) {
    loading.value = true
    try {
      const res = await studentLoginApi(studentId)
      const { accessToken, refreshToken, user: userData } = res.data

      token.value = accessToken
      refreshTokenValue.value = refreshToken
      user.value = userData

      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      localStorage.setItem('user', JSON.stringify(userData))

      return userData
    } finally {
      loading.value = false
    }
  }

  function setUser(userData) {
    user.value = userData
    localStorage.setItem('user', JSON.stringify(userData))
  }

  function initFromStorage() {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        user.value = JSON.parse(storedUser)
      } catch {
        user.value = null
      }
    }
  }

  function logout() {
    user.value = null
    token.value = ''
    refreshTokenValue.value = ''
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
  }

  // Initialize from localStorage on creation
  initFromStorage()

  return {
    user,
    token,
    refreshTokenValue,
    loading,
    isLoggedIn,
    isAdmin,
    displayName,
    username,
    login,
    studentLogin,
    setUser,
    logout,
    initFromStorage,
  }
})
