import request from './request'
import { ElMessage } from 'element-plus'

export function getUsers(params) {
  return request.get('/users', { params })
}

export function createUser(data) {
  return request.post('/users', data)
}

export function updateUser(id, data) {
  return request.put(`/users/${id}`, data)
}

export function deleteUser(id) {
  return request.delete(`/users/${id}`)
}

export function resetPassword(id) {
  return request.put(`/users/${id}/reset-password`)
}

/**
 * Trigger file download - opens download URL directly for instant browser response
 */
export function downloadResource(id) {
  const token = localStorage.getItem('accessToken')
  const url = `/api/v1/resources/${id}/download?token=${token}`
  window.open(url, '_blank')
}
