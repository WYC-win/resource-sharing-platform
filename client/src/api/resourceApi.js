import request from './request'

export function getResources(params) {
  return request.get('/resources', { params })
}

export function getResourceDetail(id) {
  return request.get(`/resources/${id}`)
}

export function uploadResource(formData) {
  return request.post('/resources', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  })
}

export function getMyUploads(params) {
  return request.get('/resources/mine', { params })
}

export function getAdminResources(params) {
  return request.get('/resources/admin', { params })
}

export function reviewResource(id, data) {
  return request.post(`/resources/${id}/review`, data)
}

export function deleteResource(id) {
  return request.delete(`/resources/${id}`)
}

export function updateResource(id, data) {
  return request.put(`/resources/${id}`, data)
}
