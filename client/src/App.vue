<template>
  <component :is="layout">
    <router-view />
  </component>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { useAuthStore } from '@/stores/authStore'

const route = useRoute()
const authStore = useAuthStore()

const layout = computed(() => {
  // Login and error pages have no layout
  if (route.meta.layout === 'none') return 'div'

  // Admin routes use AdminLayout
  if (route.meta.requiresAdmin || route.path.startsWith('/admin')) {
    return AdminLayout
  }

  // Everything else uses DefaultLayout
  return DefaultLayout
})
</script>
