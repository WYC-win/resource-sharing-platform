import request from './request'

export function login(data) {
  return request.post('/auth/login', data)
}

export function studentLogin(studentId) {
  return request.post('/auth/student-login', { studentId })
}

export function getProfile() {
  return request.get('/auth/profile')
}

export function refreshToken(refreshToken) {
  return request.post('/auth/refresh', { refreshToken })
}

export function changePassword(data) {
  return request.put('/auth/password', data)
}
