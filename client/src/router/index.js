import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/LoginView.vue'),
    meta: { requiresAuth: false, layout: 'none' },
  },
  {
    path: '/',
    redirect: '/resources',
  },
  // Student routes
  {
    path: '/resources',
    name: 'ResourceList',
    component: () => import('@/views/student/ResourceListView.vue'),
    meta: { requiresAuth: true, title: '资源浏览' },
  },
  {
    path: '/resources/:id',
    name: 'ResourceDetail',
    component: () => import('@/views/student/ResourceDetailView.vue'),
    meta: { requiresAuth: true, title: '资源详情' },
  },
  {
    path: '/my-uploads',
    name: 'MyUploads',
    component: () => import('@/views/student/MyUploadsView.vue'),
    meta: { requiresAuth: true, title: '我的上传' },
  },
  // Admin routes
  {
    path: '/admin',
    redirect: '/admin/dashboard',
  },
  {
    path: '/admin/dashboard',
    name: 'AdminDashboard',
    component: () => import('@/views/admin/DashboardView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: '仪表盘' },
  },
  {
    path: '/admin/review',
    name: 'AdminReview',
    component: () => import('@/views/admin/ReviewListView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: '资源审核' },
  },
  {
    path: '/admin/resources',
    name: 'AdminResources',
    component: () => import('@/views/admin/AllResourcesView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: '资源管理' },
  },
  {
    path: '/admin/users',
    name: 'AdminUsers',
    component: () => import('@/views/admin/UserManageView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: '用户管理' },
  },
  {
    path: '/admin/categories',
    name: 'AdminCategories',
    component: () => import('@/views/admin/CategoryManageView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: '分类管理' },
  },
  {
    path: '/admin/courses',
    name: 'AdminCourses',
    component: () => import('@/views/admin/CourseManageView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: '课程管理' },
  },
  {
    path: '/admin/logs',
    name: 'AdminLogs',
    component: () => import('@/views/admin/LiveLogView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: '实时日志' },
  },
  {
    path: '/admin/mobile',
    name: 'AdminMobile',
    component: () => import('@/views/admin/MobileAdminView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, layout: 'none' },
  },
  // 404
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/NotFoundView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Simple mobile detection
function isMobile() {
  return /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent)
}

// Navigation guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    next({ path: '/resources' })
    return
  }

  // Mobile admin: redirect to mobile-friendly admin page
  if (to.meta.requiresAdmin && isMobile() && to.path !== '/admin/mobile' && !to.path.startsWith('/admin/mobile')) {
    const forceDesktop = sessionStorage.getItem('adminDesktopMode')
    if (!forceDesktop) {
      next({ path: '/admin/mobile' })
      return
    }
  }

  if (to.path === '/login' && authStore.isLoggedIn) {
    next({ path: authStore.isAdmin ? '/admin/dashboard' : '/resources' })
    return
  }

  next()
})

export default router
