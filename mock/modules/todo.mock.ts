import { defineMock } from 'vite-plugin-mock-dev-server'

// 模拟后端的"内存数据库"：dev server 存活期间数据持久，重启后重置。
// mock 扮演"服务端"，数据形状在此自定义，不依赖前端类型。
interface Todo {
  id: number
  title: string
  done: boolean
}

let nextId = 3
const db: Todo[] = [
  { id: 1, title: '学习 Vue3 组合式 API', done: true },
  { id: 2, title: '用 Pinia 管理状态', done: false },
]

// 统一信封格式，与 src/api/types.ts 的 ApiResult 保持一致
function ok<T>(data: T) {
  return { code: 0, msg: 'success', data }
}

export default defineMock([
  {
    url: '/api/todo/list',
    delay: 200,
    body: () => ok(db),
  },
  {
    url: '/api/todo/add',
    method: 'POST',
    delay: 300,
    body: (request) => {
      const title = String(request.body?.title ?? '').trim()
      if (!title)
        return { code: 1, msg: 'title is required', data: null }

      const todo: Todo = { id: nextId++, title, done: false }
      db.push(todo)
      return ok(todo)
    },
  },
  {
    url: '/api/todo/:id',
    method: 'PUT',
    delay: 300,
    body: (request) => {
      const id = Number(request.params.id)
      const todo = db.find(item => item.id === id)
      if (!todo)
        return { code: 1, msg: 'todo not found', data: null }

      // 部分更新语义：字段存在才生效
      if (request.body?.title !== undefined) {
        const title = String(request.body.title).trim()
        if (!title)
          return { code: 1, msg: 'title cannot be empty', data: null }

        todo.title = title
      }
      if (request.body?.done !== undefined)
        todo.done = Boolean(request.body.done)

      return ok(todo)
    },
  },
  {
    url: '/api/todo/:id',
    method: 'DELETE',
    delay: 300,
    body: (request) => {
      const id = Number(request.params.id)
      const index = db.findIndex(item => item.id === id)
      if (index !== -1)
        db.splice(index, 1)

      return ok(null)
    },
  },
])
