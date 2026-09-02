import request from '@/utils/request'
import type { ApiResult } from './types'

export interface TodoItem {
  id: number
  title: string
  done: boolean
}

export function getTodoList() {
  return request<ApiResult<TodoItem[]>>('/todo/list')
}

export function addTodo(title: string) {
  return request.post<ApiResult<TodoItem>>('/todo/add', { title })
}

export function updateTodo(id: number, done: boolean) {
  return request.put<ApiResult<TodoItem>>(`/todo/${id}`, { done })
}

export function deleteTodo(id: number) {
  return request.delete<ApiResult<null>>(`/todo/${id}`)
}
