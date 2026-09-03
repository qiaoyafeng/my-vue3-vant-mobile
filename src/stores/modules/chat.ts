import { defineStore } from 'pinia'
import type { ChatMessage } from '@/api/openai'
import { streamChatCompletion } from '@/api/openai'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const streaming = ref(false)
  let controller: AbortController | null = null

  // id 分配：取现有最大 id 续增，持久化恢复后也不会冲突
  function allocId(): number {
    const max = messages.value.reduce((acc, item) => Math.max(acc, item.id), 0)
    return max + 1
  }

  const send = async (content: string) => {
    const text = content.trim()
    if (!text || streaming.value)
      return

    messages.value.push({ id: allocId(), role: 'user', content: text })

    // system 消息来自环境变量，不存入 messages，每次发送时动态拼接
    const systemPrompt = (import.meta.env.VITE_OPENAI_SYSTEM_PROMPT || '').trim()
    const payload = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      ...messages.value.map(({ role, content }) => ({ role, content })),
    ]

    // 保守更新：先放 assistant 占位，流式增量填充。
    // 必须用 reactive 包裹：若持有 raw 对象引用，reply.content += delta
    // 绕过 Proxy 的 set 拦截器，不会触发视图更新，回复会整块而非逐字出现
    const reply = reactive<ChatMessage>({ id: allocId(), role: 'assistant', content: '' })
    messages.value.push(reply)

    streaming.value = true
    controller = new AbortController()
    try {
      await streamChatCompletion(payload, {
        signal: controller.signal,
        onDelta: (delta) => {
          reply.content += delta
        },
      })
    }
    catch (error) {
      // 失败时移除空占位（避免空气泡）；已收到部分文本则保留
      if (!reply.content)
        messages.value = messages.value.filter(item => item.id !== reply.id)
      throw error // action 不吞错，页面负责 Toast
    }
    finally {
      streaming.value = false
      controller = null
    }
  }

  // 手动停止：api 层把 AbortError 视为正常结束，已生成文本保留
  const stop = () => {
    controller?.abort()
  }

  const clear = () => {
    messages.value = []
  }

  return { messages, streaming, send, stop, clear }
}, {
  persist: {
    pick: ['messages'], // 只持久化历史；streaming 等瞬时态不落盘（v4 语法）
  },
})

export default useChatStore
