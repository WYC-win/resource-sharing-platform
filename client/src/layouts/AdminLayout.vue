<template>
  <div class="admin-layout">
    <AppHeader @toggle-sidebar="sidebarOpen = !sidebarOpen" />
    <div class="admin-body">
      <!-- Overlay for mobile -->
      <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false" />
      <AppSidebar :class="{ 'sidebar-open': sidebarOpen }" />
      <main class="admin-main">
        <div class="page-container">
          <router-view />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import AppHeader from '@/components/common/AppHeader.vue'
import AppSidebar from '@/components/common/AppSidebar.vue'

const sidebarOpen = ref(false)
</script>

<style scoped>
.admin-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  width: 100%;
}

.admin-body {
  display: flex;
  flex: 1;
  padding-top: 60px;
  position: relative;
}

.admin-main {
  flex: 1;
  margin-left: 220px;
  min-height: calc(100vh - 60px);
  background: #f5f7fa;
}

.sidebar-overlay {
  display: none;
}

@media (max-width: 768px) {
  .admin-main {
    margin-left: 0;
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    top: 60px;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 99;
  }
}
</style>
