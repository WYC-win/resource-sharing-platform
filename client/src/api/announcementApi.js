import request from './request'

export function getAnnouncements() {
  return request.get('/announcements')
}

export function getAdminAnnouncements(params) {
  return request.get('/announcements/admin', { params })
}

export function createAnnouncement(data) {
  return request.post('/announcements', data)
}

export function updateAnnouncement(id, data) {
  return request.put(`/announcements/${id}`, data)
}

export function deleteAnnouncement(id) {
  return request.delete(`/announcements/${id}`)
}

export function publishAnnouncement(id) {
  return request.put(`/announcements/${id}/publish`)
}

export function unpublishAnnouncement(id) {
  return request.put(`/announcements/${id}/unpublish`)
}

export function togglePinAnnouncement(id) {
  return request.put(`/announcements/${id}/pin`)
}
