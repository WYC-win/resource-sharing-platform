import request from './request'

export function getCourses() {
  return request.get('/courses')
}

export function getAllCourses() {
  return request.get('/courses/all')
}

export function createCourse(data) {
  return request.post('/courses', data)
}

export function updateCourse(id, data) {
  return request.put(`/courses/${id}`, data)
}

export function deleteCourse(id) {
  return request.delete(`/courses/${id}`)
}
