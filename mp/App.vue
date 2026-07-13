<template><view><slot /></view></template>
<script>
export default {
  onLaunch() {
    const token = uni.getStorageSync('accessToken')
    const pages = getCurrentPages()
    if (!token && pages.length > 0) {
      uni.reLaunch({ url: '/pages/index/index' })
    }
  }
}
</script>
<style>page{background-color:#f5f7fa;}</style>
