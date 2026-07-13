const BASE_URL = 'https://cugbshare.asia/api/v1'

function getToken() {
  return uni.getStorageSync('accessToken') || ''
}

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    const token = getToken()
    const header = { 'Content-Type': 'application/json' }
    if (token) header['Authorization'] = 'Bearer ' + token

    uni.request({
      url: BASE_URL + path,
      method: method,
      data: data,
      header: header,
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 200) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          uni.removeStorageSync('accessToken')
          uni.removeStorageSync('refreshToken')
          uni.reLaunch({ url: '/pages/index/index' })
          reject(res.data)
        } else {
          reject(res.data)
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络请求失败', icon: 'none' })
        reject(err)
      }
    })
  })
}

export function studentLogin(studentId) {
  return request('POST', '/auth/student-login', { studentId })
}

export function getCourses() {
  return request('GET', '/courses')
}

export function getAllCourses() {
  return request('GET', '/courses/all')
}

export function getResources(params) {
  return request('GET', '/resources', params)
}

export function getResourceDetail(id) {
  return request('GET', '/resources/' + id)
}

export function uploadResource(formData) {
  return new Promise((resolve, reject) => {
    const token = getToken()
    uni.uploadFile({
      url: BASE_URL + '/resources',
      filePath: formData.filePath,
      name: 'file',
      formData: {
        title: formData.title,
        course_id: formData.course_id || '',
        category_id: formData.category_id || '',
        description: formData.description || ''
      },
      header: { 'Authorization': 'Bearer ' + token },
      success: (res) => {
        try { resolve(JSON.parse(res.data)) }
        catch { reject(res) }
      },
      fail: reject
    })
  })
}

export function getMyUploads(params) {
  return request('GET', '/resources/mine', params)
}

export function downloadResource(id, onProgress) {
  const token = getToken()
  const url = BASE_URL + '/resources/' + id + '/download?token=' + token
  const task = uni.downloadFile({
    url: url,
    success: (res) => {
      if (res.statusCode === 200) {
        uni.openDocument({ filePath: res.tempFilePath, showMenu: true })
      } else {
        uni.showToast({ title: '下载失败', icon: 'none' })
      }
    },
    fail: () => { uni.showToast({ title: '下载失败', icon: 'none' }) }
  })
  if (onProgress) {
    task.onProgressUpdate((res) => {
      onProgress(res.progress)
    })
  }
}

export function previewResource(id) {
  const token = getToken()
  const url = BASE_URL + '/resources/' + id + '/preview?token=' + token
  uni.showLoading({ title: '加载中...' })
  // For PDF: download and open inline
  uni.downloadFile({
    url: url,
    success: (res) => {
      if (res.statusCode === 200) {
        uni.openDocument({ filePath: res.tempFilePath, showMenu: true })
      }
    },
    fail: () => { uni.showToast({ title: '预览失败', icon: 'none' }) },
    complete: () => { uni.hideLoading() }
  })
}

// Save login data
export function saveLoginData(data) {
  uni.setStorageSync('accessToken', data.accessToken)
  uni.setStorageSync('refreshToken', data.refreshToken)
  uni.setStorageSync('user', JSON.stringify(data.user))
}
