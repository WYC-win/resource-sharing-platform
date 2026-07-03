<template>
  <div class="not-found">
    <h1>404</h1>
    <p>页面不存在</p>
    <el-button type="primary" @click="$router.push('/resources')">
      返回首页
    </el-button>
  </div>
</template>

<style scoped>
.not-found {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.not-found h1 {
  font-size: 72px;
  color: #409eff;
  margin: 0;
}
.not-found p {
  font-size: 18px;
  color: #909399;
}
</style>
