import { defineMock } from 'vite-plugin-mock-dev-server'

// LLM 假网关：模拟 OpenAI 兼容的 /chat/completions SSE 流式接口。
// 开发期前端 VITE_OPENAI_BASE_URL=/api/openai/v1 时命中本 mock；
// 接真实网关时改环境变量即可，前端代码不变。
// 鉴权：要求 Authorization: Bearer <token>（复用 mock 登录的 token），
// 缺失返回 401 { code, message }（项目错误响应规范）。
const MOCK_REPLY = '你好！我是接入本地 mock 的 AI 助手。'
  + '这条回复被拆成多个小块，以 SSE（text/event-stream）逐段推送，'
  + '用于在开发期验证前端流式渲染与停止生成，不产生任何真实费用。'

export default defineMock([
  {
    url: '/api/openai/v1/chat/completions',
    method: 'POST',
    response(req, res) {
      const auth = String(req.headers.authorization ?? '')
      if (!auth.startsWith('Bearer ') || auth.length <= 'Bearer '.length) {
        res.statusCode = 401
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ code: 401, message: 'unauthorized' }))
        return
      }

      res.statusCode = 200
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      // 固定回复按 4 字符拆块，每 40ms 推一段 delta
      const chunks = MOCK_REPLY.match(/[\s\S]{1,4}/g) ?? []
      let index = 0
      const timer = setInterval(() => {
        if (index >= chunks.length) {
          res.write('data: [DONE]\n\n')
          res.end()
          clearInterval(timer)
          return
        }
        const payload = { choices: [{ delta: { content: chunks[index] } }] }
        res.write(`data: ${JSON.stringify(payload)}\n\n`)
        index++
      }, 40)

      // 客户端中断（前端停止生成/页面离开）时停止推送，释放定时器
      req.on('close', () => clearInterval(timer))
    },
  },
])
