<script setup lang="ts">
import { showConfirmDialog, showToast } from 'vant'
import { useChatStore } from '@/stores'
import { isLogin } from '@/utils/auth'

const { t } = useI18n()
const router = useRouter()
const chatStore = useChatStore()

const draft = ref('')
const listRef = ref<HTMLElement | null>(null)

const lastMessage = computed(() => chatStore.messages.at(-1))

// 流式内容增长时自动滚到底部
watch(
  () => lastMessage.value?.content,
  () => {
    nextTick(() => {
      const el = listRef.value
      if (el)
        el.scrollTop = el.scrollHeight
    })
  },
)

async function onSend() {
  const content = draft.value.trim()
  if (!content || chatStore.streaming)
    return
  draft.value = ''
  try {
    await chatStore.send(content)
  }
  catch (error) {
    showToast(error instanceof Error && error.message ? error.message : t('chat.sendFailed'))
  }
}

function onStop() {
  chatStore.stop()
}

async function onClear() {
  try {
    await showConfirmDialog({ title: t('chat.clear'), message: t('chat.clearConfirm') })
    chatStore.clear()
  }
  catch {} // 用户取消
}

function goLogin() {
  router.push({ name: 'Login' })
}
</script>

<template>
  <div class="chat-page">
    <van-notice-bar v-if="!isLogin()" wrapable :scrollable="false">
      {{ t('chat.loginRequired') }}
      <template #right-icon>
        <van-button size="mini" plain type="primary" @click="goLogin">
          {{ t('chat.goLogin') }}
        </van-button>
      </template>
    </van-notice-bar>

    <div ref="listRef" class="p-3 flex-1 min-h-0 overflow-y-auto">
      <van-empty v-if="chatStore.messages.length === 0" :description="t('chat.emptyHint')" />
      <div
        v-for="msg in chatStore.messages"
        :key="msg.id"
        class="mb-3 flex"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="leading-6 px-3 py-2 rounded-lg max-w-[80%] whitespace-pre-wrap break-words"
          :class="msg.role === 'user'
            ? 'text-white bg-[var(--van-primary-color)]'
            : 'bg-[var(--van-background-2)] text-[var(--van-text-color)]'"
        >
          {{ msg.content }}<span
            v-if="chatStore.streaming && msg.role === 'assistant' && msg.id === lastMessage?.id"
            class="chat-cursor"
          >▍</span>
        </div>
      </div>
    </div>

    <div class="p-2 border-t border-[var(--van-border-color)] bg-[var(--van-background-2)] flex gap-2 items-end">
      <van-icon
        name="delete-o"
        size="22"
        class="mb-2 px-1 shrink-0"
        @click="onClear"
      />
      <van-field
        v-model="draft"
        type="textarea"
        rows="1"
        autosize
        :placeholder="t('chat.placeholder')"
        class="chat-field flex-1"
        @keydown.enter.prevent="onSend"
      />
      <van-button
        v-if="chatStore.streaming"
        size="small"
        type="danger"
        class="mb-1 shrink-0"
        @click="onStop"
      >
        {{ t('chat.stop') }}
      </van-button>
      <van-button
        v-else
        size="small"
        type="primary"
        class="mb-1 shrink-0"
        :disabled="!draft.trim() || !isLogin()"
        @click="onSend"
      >
        {{ t('chat.send') }}
      </van-button>
    </div>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  /* NavBar 高度之外占满视口，消息区滚动、输入条贴底 */
  height: calc(100vh - var(--van-nav-bar-height));
}

.chat-cursor {
  animation: chat-blink 0.8s step-start infinite;
  color: var(--van-primary-color);
}

@keyframes chat-blink {
  50% {
    opacity: 0;
  }
}
</style>

<route lang="json5">
{
  name: 'Chat'
}
</route>
