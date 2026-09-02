<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { TodoItem } from '@/api/todo'
import { showConfirmDialog, showToast } from 'vant'
import { useTodoStore } from '@/stores'

const { t } = useI18n()
const todoStore = useTodoStore()
const { todos, loading } = storeToRefs(todoStore)

const newTitle = ref('')

onMounted(() => {
  todoStore.load()
})

async function onAdd() {
  const title = newTitle.value.trim()
  // 客户端校验：空标题直接拦截，不发请求
  if (!title) {
    showToast(t('todo.emptyTitle'))
    return
  }
  try {
    await todoStore.add(title)
    newTitle.value = ''
  }
  catch {
    showToast(t('todo.fail'))
  }
}

async function onToggle(item: TodoItem, checked: boolean) {
  try {
    await todoStore.toggle(item.id, checked)
  }
  catch {
    showToast(t('todo.fail'))
    // 失败后重新拉取，保证 UI 与服务端一致
    todoStore.load()
  }
}

async function onDelete(item: TodoItem) {
  // showConfirmDialog：点确认 resolve，点取消 reject
  try {
    await showConfirmDialog({
      title: t('todo.delete'),
      message: t('todo.deleteConfirm'),
    })
  }
  catch {
    return
  }
  try {
    await todoStore.remove(item.id)
  }
  catch {
    showToast(t('todo.fail'))
  }
}
</script>

<template>
  <van-cell-group inset class="mt-3">
    <van-field
      v-model="newTitle"
      :placeholder="$t('todo.placeholder')"
      clearable
      @keyup.enter="onAdd"
    >
      <template #button>
        <van-button size="small" type="primary" @click="onAdd">
          {{ $t('todo.add') }}
        </van-button>
      </template>
    </van-field>
  </van-cell-group>

  <van-loading v-if="loading" class="mt-6 w-full justify-center" />

  <van-cell-group v-else :title="$t('todo.title')" class="mt-3">
    <van-swipe-cell v-for="item in todos" :key="item.id">
      <van-cell center :title="item.title" :class="item.done ? 'line-through op-50' : ''">
        <template #right-icon>
          <van-checkbox
            :model-value="item.done"
            @update:model-value="onToggle(item, $event)"
          />
        </template>
      </van-cell>
      <template #right>
        <van-button square type="danger" class="h-full" @click="onDelete(item)">
          {{ $t('todo.delete') }}
        </van-button>
      </template>
    </van-swipe-cell>

    <van-empty v-if="todos.length === 0" :description="$t('todo.empty')" />
  </van-cell-group>
</template>

<route lang="json5">
{
  name: 'Todo'
}
</route>
