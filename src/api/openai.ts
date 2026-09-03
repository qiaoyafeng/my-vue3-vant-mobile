import { getToken } from '@/utils/auth'

/** 页面/store 使用的消息形态（带 id，用于列表 key 与流式定位） */
export interface ChatMessage {
  id: number
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 发给网关的消息形态（OpenAI 协议，不带 id） */
export interface ChatApiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface StreamOptions {
  signal: AbortSignal
  /** 每收到一段增量文本回调一次 */
  onDelta: (text: string) => void
}

// LLM 网关地址（OpenAI 兼容），开发期指向本地 mock
const BASE_URL = import.meta.env.VITE_OPENAI_BASE_URL || '/api/openai/v1'
const MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'

// 错误响应遵循项目规范（code + message 字段），兼容 OpenAI 的 error.message 形态
function extractErrorMessage(payload: any, status: number): string {
  if (typeof payload?.message === 'string' && payload.message)
    return payload.message
  if (typeof payload?.error?.message === 'string' && payload.error.message)
    return payload.error.message
  return `请求失败（HTTP ${status}）`
}

/**
 * 流式对话：POST {BASE_URL}/chat/completions（OpenAI 兼容协议）
 *
 * 传输层说明：此处使用原生 fetch 而非项目统一封装的 axios——
 * axios 在浏览器端无法流式读取响应体，而 chat 需要逐段解析 SSE。
 * 鉴权使用标准 Authorization: Bearer 头（网关协议），token 复用现有登录态；
 * API Key 只存在于网关侧，前端代码与环境文件均不保存任何 key。
 *
 * 返回完整回复文本；HTTP 错误抛出（优先网关 message，兼容 error.message）；
 * AbortError 在函数内部吞掉并正常返回已累积文本（手动停止 = 正常结束）。
 */
export async function streamChatCompletion(
  messages: ChatApiMessage[],
  options: StreamOptions,
): Promise<string> {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
    }),
    signal: options.signal,
  })

  if (!response.ok) {
    let payload: any = null
    try {
      payload = await response.json()
    }
    catch {}
    throw new Error(extractErrorMessage(payload, response.status))
  }

  if (!response.body)
    throw new Error('响应不支持流式读取')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      buffer += decoder.decode(value, { stream: true })
      // SSE 事件以空行分隔；末尾可能是半截事件，留到下一轮缓冲
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const event of events) {
        const line = event.trim()
        if (!line || !line.startsWith('data:'))
          continue
        const data = line.slice(5).trim()
        if (data === '[DONE]')
          return full
        try {
          const json = JSON.parse(data)
          const delta: string | undefined = json.choices?.[0]?.delta?.content
          if (delta) {
            full += delta
            options.onDelta(delta)
          }
        }
        catch {}
      }
    }
  }
  catch (err) {
    // 手动停止：reader.read() 会以 AbortError reject，视为正常结束
    if (options.signal.aborted)
      return full
    throw err
  }
  return full
}
