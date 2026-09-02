<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { TodoItem } from '@/api/todo'
import { showConfirmDialog, showToast } from 'vant'
import { useTodoStore } from '@/stores'

const { t } = useI18n()
const todoStore = useTodoStore()
const { todos, loading } = storeToRefs(todoStore)

const newTitle = ref('')

// 编辑弹窗状态：显隐 / 当前编辑条目 / 编辑框内容
const showEdit = ref(false)
const editingId = ref(0)
const editingTitle = ref('')

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
function onEdit(item: TodoItem) {
  editingId.value = item.id
  editingTitle.value = item.title
  showEdit.value = true
}

// van-dialog 的异步关闭控制：返回 false 阻止关闭
async function onEditBeforeClose(action: string) {
  // 取消 / 遮罩：直接放行关闭，不保存
  if (action !== 'confirm')
    return true

  const title = editingTitle.value.trim()
  if (!title) {
    showToast(t('todo.emptyTitle'))
    return false // 空标题不允许保存
  }
  try {
    await todoStore.rename(editingId.value, title)
    return true // 保存成功，放行关闭
  }
  catch {
    showToast(t('todo.fail'))
    return false // 失败保持打开，可改后重试或取消
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
      <van-cell
        center
        :title="item.title"
        :class="item.done ? 'line-through op-50' : ''"
        @click="onEdit(item)"
      >
        <template #right-icon>
          <van-checkbox
            :model-value="item.done"
            @click.stop
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

  <van-dialog
    v-model:show="showEdit"
    :title="$t('todo.editTitle')"
    show-cancel-button
    :before-close="onEditBeforeClose"
  >
    <van-field v-model="editingTitle" />
  </van-dialog>
</template>

<route lang="json5">
{
  name: 'Todo'
}
</route>
