import { defineMock } from 'vite-plugin-mock-dev-server'

// face 会话上传 mock：采满帧后前端一次性 POST 整个会话 JSON
// 统一信封格式，与 src/api/types.ts 的 ApiResult 保持一致
function ok<T>(data: T) {
  return { code: 0, msg: 'success', data }
}

export default defineMock([
  {
    url: '/api/face/sessions',
    method: 'POST',
    delay: 300,
    body: (request) => {
      const frames = request.body?.frames
      if (!Array.isArray(frames) || frames.length === 0)
        return { code: 1, msg: 'invalid session payload', data: null }

      return ok({ id: `face_${Date.now()}` })
    },
  },
])
