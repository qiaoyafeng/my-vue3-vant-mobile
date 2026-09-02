import { defineStore } from 'pinia'
import type { TodoItem } from '@/api/todo'
import {
  addTodo as addTodoApi,
  deleteTodo as deleteTodoApi,
  getTodoList,
  updateTodo as updateTodoApi,
} from '@/api/todo'

export const useTodoStore = defineStore('todo', () => {
  const todos = ref<TodoItem[]>([])
  const loading = ref(false)

  const load = async () => {
    loading.value = true
    try {
      const { data } = await getTodoList()
      todos.value = data
    }
    finally {
      loading.value = false
    }
  }

  const add = async (title: string) => {
    // 保守更新：等接口成功后再写入本地（进阶可研究"乐观更新"）
    const { data } = await addTodoApi(title)
    todos.value.push(data)
  }

  const toggle = async (id: number, done: boolean) => {
    const { data } = await updateTodoApi(id, done)
    const index = todos.value.findIndex(item => item.id === id)
    if (index !== -1)
      todos.value[index] = data
  }

  const remove = async (id: number) => {
    await deleteTodoApi(id)
    todos.value = todos.value.filter(item => item.id !== id)
  }

  return {
    todos,
    loading,
    load,
    add,
    toggle,
    remove,
  }
})

export default useTodoStore
