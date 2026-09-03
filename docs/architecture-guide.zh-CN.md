# 项目架构与代码加载流程指南

> 覆盖：启动加载链路 → 框架分层 → 核心机制 → Todo 功能实现剖析 → 基础语法速查 → 新功能 checklist。
> 所有文件路径均可在编辑器中直接跳转。

---

## 目录

1. [技术栈总览](#一技术栈总览)
2. [启动与加载全链路](#二启动与加载全链路)
3. [目录架构与分层职责](#三目录架构与分层职责)
4. [六大核心机制](#四六大核心机制)
5. [一次请求的完整生命周期](#五一次请求的完整生命周期)
6. [Todo 功能实现剖析](#六todo-功能实现剖析)
7. [基础语法速查表](#七基础语法速查表)
8. [新功能实现 Checklist](#八新功能实现-checklist)

---

## 一、技术栈总览

| 层面 | 技术 | 作用 |
|---|---|---|
| 构建工具 | Vite 8 | 开发服务器 + 打包 |
| 核心框架 | Vue 3.5（组合式 API） | 视图与响应式状态 |
| 语言 | TypeScript | JS + 静态类型，编译期检查 |
| UI 组件库 | Vant 4 | 移动端组件（按钮/弹窗/列表…） |
| 状态管理 | Pinia | 跨组件共享的全局状态 |
| 路由 | Vue Router | URL ↔ 页面组件映射 |
| HTTP | axios（二次封装） | 请求库 |
| 样式 | UnoCSS + Less | 原子化 class 即时生成 |
| 国际化 | vue-i18n | 三语文案 |
| Mock | vite-plugin-mock-dev-server | 开发期假后端 |
| 包管理 | pnpm | 依赖管理 |

---

## 二、启动与加载全链路

### 2.1 阶段一：进程启动（构建层）

```
pnpm dev（实际执行: cross-env MOCK_SERVER_PORT=8086 vite）
  │
  ├─ 读取 vite.config.ts
  │    ├─ loadEnv() 加载 .env / .env.development 环境变量
  │    ├─ base = VITE_APP_PUBLIC_PATH
  │    ├─ createVitePlugins(mode) ← build/vite/index.ts 装配 12 个插件
  │    └─ server.proxy: '/api' → 转发真实后端（target 未配置时请求会报错）
  │
  ├─ Vite 开发服务器就绪（端口 3000）
  │
  └─ 浏览器请求 http://localhost:3000 → 返回 index.html
       index.html 里只有一行关键代码: <script type="module" src="/src/main.ts">
```

### 2.2 阶段二：插件装配（build/vite/index.ts）

这是理解"魔法"的关键文件。Vite 插件本质是"编译期钩子"，在代码到达浏览器前改写它：

| 插件 | 干的事 | 产物 |
|---|---|---|
| `VueRouter()` | 扫描 `src/pages/` 目录生成路由表 | `src/types/route-map.d.ts` |
| `vue()` | 把 .vue 单文件组件编译成 JS | — |
| `Components({ resolvers: [VantResolver()] })` | 模板里的 `<van-xxx>` / 自定义组件自动补 import | `src/types/components.d.ts` |
| `AutoImport({...})` | `ref`/`computed`/`onMounted` 等 API 自动补 import | `src/types/auto-imports.d.ts` |
| `mockDevServerPlugin()` | 拦截 `/api/*` 请求返回 mock 数据 | 读 `mock/**/*.mock.ts` |
| `UnoCSS()` | 按需生成原子化 CSS（`mt-3` → `margin-top`） | `virtual:uno.css` |
| `VueI18nPlugin` | 预编译 `src/locales/*.json` | — |
| 其余 | PWA / DevTools / vConsole / legacy 兼容 | — |

> 三个 `.d.ts` 文件是**自动生成的**，禁止手改。它们只服务于 IDE 类型提示。

### 2.3 阶段三：应用装配（src/main.ts）

```ts
const app = createApp(App)     // ① 创建应用实例
app.use(head)                  // ② 文档 <head> 管理（标题/meta 动态化）
app.use(router)                // ③ 挂载路由系统
app.use(pinia)                 // ④ 挂载状态管理
app.use(i18n)                  // ⑤ 挂载国际化
app.mount('#app')              // ⑥ 渲染到 index.html 的 <div id="app">
```

### 2.4 阶段四：组件树渲染

```
App.vue（根组件 = 页面骨架）
├─ <van-config-provider :theme="mode">   ← 深色/浅色主题注入所有 Vant 组件
│    ├─ <NavBar/>                        ← 顶部导航（标题随路由变化）
│    ├─ <router-view v-slot="{ Component }">
│    │    └─ <keep-alive :include="keepAliveRouteNames">
│    │         └─ <component :is="Component"/>   ← 当前路由对应的页面组件
│    ├─ <TabBar/>                        ← 底部标签栏
└─ （useHead 设置页面标题/图标/主题色）
```

### 2.5 阶段五：路由匹配与守卫（src/router/index.ts）

路由表**不是手写的**，来自 `vue-router/auto-routes`（插件扫描 `src/pages/` 的结果）：

| 文件 | 生成的路由 |
|---|---|
| `src/pages/index.vue` | `/`，name 由 `<route>` 块定义为 `Home` |
| `src/pages/todo/index.vue` | `/todo`，name `Todo` |
| `src/pages/[...all].vue` | 任意未匹配路径 → 404 页 |

每次跳转都会经过路由守卫：

```
router.beforeEach(to):
  1. NProgress.start()                    顶部进度条
  2. routeCacheStore.addRoute(to)         meta.keepAlive 的路由加入缓存名单
  3. setPageTitle(to.name)                用 locales 的 navbar.<name> 设标题
  4. 已有 token 但 store 无用户信息 → 自动调 /user/me 恢复登录态
router.afterEach: NProgress.done()
```

> 注意：守卫目前**没有**"未登录强制跳登录页"逻辑——这是预留的改造点。

---

## 三、目录架构与分层职责

```
src/
├── main.ts              入口：创建实例、注册插件、挂载
├── App.vue              根组件：主题 + 骨架布局
├── pages/               【页面=路由】文件即路由，零注册
│   └── todo/index.vue   页面层：交互与展示（本次新增）
├── api/                 接口层：类型 + 请求函数，纯函数无状态
│   ├── types.ts         共享响应信封 ApiResult<T>（本次新增）
│   ├── user.ts          登录/登出/用户信息
│   └── todo.ts          待办 CRUD（本次新增）
├── stores/              状态层：Pinia store
│   ├── modules/todo.ts  待办状态与动作（本次新增）
│   ├── modules/user.ts  用户态（persist 持久化到 localStorage）
│   └── modules/routeCache.ts  keep-alive 名单
├── utils/               基础设施层
│   ├── request.ts       axios 封装：token 注入 + 401/403 统一处理
│   ├── auth.ts          token 存取（响应式 localStorage）
│   └── i18n.ts          语言切换
├── composables/         组合式函数（目录内导出即自动导入）
├── components/          全局组件（NavBar/TabBar/Chart，免 import 直接用）
├── locales/             三语文案 JSON
├── config/routes.ts     根路由名单（控制 TabBar 显隐）
└── types/               ⚠️ 插件自动生成的 .d.ts，禁止手改
mock/modules/*.mock.ts   开发期假接口（与 src/api 一一对应）
build/vite/index.ts      Vite 插件装配车间
```

**调用方向永远单向**：`pages → stores → api → utils/request → mock/后端`。
反向依赖（如 api 里 import store）是架构坏味道。

---

## 四、六大核心机制

### 4.1 响应式系统（Vue 的灵魂）

`ref(0)` 创建一个**响应式**包装值。模板里用到它时，Vue 记录"这个视图依赖这个值"；`.value` 一变，依赖它的视图**自动重渲染**。

```
传统思维:  改数据 → 手动调 render()
Vue 思维:  改数据 → 视图自动更新（发布-订阅，订阅关系在首次渲染时自动建立）
```

`computed` 是带缓存的派生值（依赖不变就不重算）；`watch` 是显式监听。

### 4.2 文件路由（零注册）

`src/pages/` 下新建 `vue` 文件 = 新增路由。文件底部的 `<route lang="json5">` 块为该路由补充 `name` / `meta` 元信息。路由名与 `locales` 的 `navbar.<路由名>` 对齐，页面标题就会自动正确。

### 4.3 自动导入（没有 import 却能用）

`ref`、`onMounted`、`useI18n`、`isDark`（composables 目录）无需 import —— AutoImport 插件编译期注入。**两个例外必须手动 import**：
- `storeToRefs`（来自 pinia，不在预设里）
- `showToast` / `showConfirmDialog`（Vant 函数式组件，且其样式已在 main.ts 手动引入）

### 4.4 请求封装（src/utils/request.ts）

`src/utils/request.ts` 是基于 axios 的单例封装：

```
请求拦截器:  从 localStorage 读 token → 塞进 'Access-Token' 请求头
响应拦截器:  剥掉 axios 外壳，直接返回 response.data（即信封 {code,msg,data}）
错误处理器:  401/403 统一弹 Notify，业务层不重复处理
baseURL:    来自 .env 的 VITE_APP_API_BASE_URL（开发环境 = /api）
```

### 4.5 Mock 与代理的分工

```
浏览器请求 /api/todo/list
  ├─ mock-dev-server 有匹配规则 → 直接返回假数据（开发期 99% 走这条）
  └─ 无匹配 → vite proxy 转发 target（真实后端），并 rewrite 去掉 /api 前缀
```

mock 文件自动发现（`mock/**/*.mock.ts`），无需注册。mock 里的模块级变量 = 后端进程内存，dev server 存活期间数据持久，重启重置。

### 4.6 keep-alive 页面缓存

页面 `<route>` 块声明 `meta: { keepAlive: true }` → 守卫把它加进 `routeCache` store → `App.vue` 的 `<keep-alive :include>` 按名单缓存组件实例 → 返回页面时状态不丢（连滚动位置，见 scroll-cache 示例页）。

---

## 五、一次请求的完整生命周期

以登录为例（最完整的一条链）：

```
① 页面 login/index.vue: 表单校验通过 → userStore.login(postData)
② store user.ts:        调 api 层 userLogin()，成功后 setToken(data.token)
③ api user.ts:          request.post('/auth/login', data)   ← 纯函数，只描述请求
④ request.ts 请求拦截器: 自动加 'Access-Token' 头
⑤ axios 发出:           baseURL(/api) + /auth/login = /api/auth/login
⑥ mock:                 user.mock.ts 匹配 → {code:0, data:{token:'admin'}}
⑦ 响应拦截器:           返回 response.data（信封本体）
⑧ store:                解构 { data } → setToken → useLocalStorage 写入
⑨ 页面:                 router.push(redirect || 'Home')
```

Todo 功能的四个接口走完全相同的管道，只是 mock 换成了 `todo.mock.ts`（有状态版）。

---

## 六、Todo 功能实现剖析

### 6.1 文件清单与数据流

```
pages/todo/index.vue ──调用──▶ stores/modules/todo.ts ──调用──▶ api/todo.ts
     ▲                                                                 │
     │                                                                 ▼
  响应式渲染 ←── todos.value 更新 ◀── 信封 {code,msg,data} ◀── request.ts ◀── mock/modules/todo.mock.ts
```

### 6.2 各文件职责

| 文件 | 职责 | 关键点 |
|---|---|---|
| `api/types.ts` | `ApiResult<T>` 信封类型 | 从 user.ts 抽出，所有接口共用 |
| `api/todo.ts` | `TodoItem` 类型 + 4 个请求函数 | 一个函数一个端点，无状态 |
| `mock/modules/todo.mock.ts` | 内存数据库 `db` + 自增 id + 4 个端点 | `request.params` 路径参数、`request.body` 请求体 |
| `stores/modules/todo.ts` | `todos`/`loading` 状态 + `load/add/toggle/remove` | 保守更新；action 不吞错 |
| `pages/todo/index.vue` | 输入、列表、勾选、滑删、空态、加载态 | `:model-value` 事件式绑定实现保守更新 |

### 6.3 store 全文走读

```ts
export const useTodoStore = defineStore('todo', () => {
  const todos = ref<TodoItem[]>([])   // 状态：列表
  const loading = ref(false)          // 状态：加载标志

  const load = async () => {
    loading.value = true              // 先亮 loading
    try {
      const { data } = await getTodoList()  // 调 api 层，解构信封的 data
      todos.value = data              // 整组替换 → 依赖 todos 的视图自动重渲染
    } finally {
      loading.value = false           // 无论成败都关 loading
    }
  }

  const add = async (title: string) => {
    const { data } = await addTodoApi(title)  // 等服务端生成 id 后返回完整条目
    todos.value.push(data)                    // 成功才写入本地（保守更新）
  }

  const toggle = async (id: number, done: boolean) => {
    const { data } = await updateTodoApi(id, done)
    const index = todos.value.findIndex(item => item.id === id)
    if (index !== -1)
      todos.value[index] = data               // 用服务端返回值原位替换
  }

  const remove = async (id: number) => {
    await deleteTodoApi(id)                   // 先等删除成功
    todos.value = todos.value.filter(item => item.id !== id)  // 再过滤掉本地
  }

  return { todos, loading, load, add, toggle, remove }
})
```

对比 user store 学到的：`persist: true` 用于 token 这种必须跨会话的数据；todo 数据源在服务端，persist 会造成脏数据——**先想清楚 source of truth 再决定要不要缓存**。

### 6.4 页面关键片段走读

添加（客户端校验 + 错误兜底）：

```ts
async function onAdd() {
  const title = newTitle.value.trim()
  if (!title) { showToast(t('todo.emptyTitle')); return }  // 前端拦截，不发请求
  try {
    await todoStore.add(title)
    newTitle.value = ''          // 成功才清空输入框
  } catch {
    showToast(t('todo.fail'))    // 失败提示（401/403 已由拦截器处理，不会走到这）
  }
}
```

勾选（保守更新的关键写法）：

```html
<!-- 不用 v-model（会立即改 UI = 乐观更新），改用"受控值 + 事件" -->
<van-checkbox :model-value="item.done" @update:model-value="onToggle(item, $event)"/>
```
点击后 checkbox 视觉立即变勾选（组件内部态），但**文字删除线要等接口成功**（`todos` 被替换后才变）——两种状态来源不同，这正是保守更新与乐观更新的分界线。

删除（对话框的 Promise 风格）：

```ts
try { await showConfirmDialog({ title, message }) }  // 确认 → resolve
catch { return }                                     // 取消 → reject
```

列表渲染：

```html
<van-swipe-cell v-for="item in todos" :key="item.id">   <!-- :key 帮 Vue 高效diff -->
  <van-cell :title="item.title" :class="item.done ? 'line-through op-50' : ''"/>
  <template #right>…删除按钮…</template>                 <!-- 具名插槽：滑动露出的区域 -->
</van-swipe-cell>
<van-empty v-if="todos.length === 0" .../>               <!-- 空态 -->
```

### 6.5 mock 有状态设计

```ts
let nextId = 3                       // 自增计数器：删除后 id 不回退，避免冲突
const db: Todo[] = [ ...种子数据 ]    // 模块级 = dev server 存活期间持久

body: (request) => {                 // body 可以是函数，拿到解析后的请求
  const id = Number(request.params.id)   // :id 路径参数
  ...
}
```

---

## 七、基础语法速查表

### 7.1 Vue SFC（单文件组件）

| 语法 | 含义 |
|---|---|
| `<script setup lang="ts">` | 组件逻辑，顶层代码自动暴露给模板 |
| `<template>` | 视图模板（HTML 扩展） |
| `<route lang="json5">` | 给文件路由补充元信息（宏块，非运行时） |
| `{{ expr }}` | 文本插值 |
| `v-model="x"` | 双向绑定（输入框↔变量） |
| `:model-value="x"` | 单向绑定（受控） |
| `v-if / v-else` | 条件渲染（不存在/存在 DOM） |
| `v-for="item in list" :key="item.id"` | 列表渲染；key 供 diff 优化 |
| `:class="条件 ? 'a' : 'b'"` | 动态 class |
| `@click="fn"` / `@keyup.enter="fn"` | 事件绑定（.enter 是修饰符） |
| `<template #right>` | 具名插槽：把内容填进子组件预留的坑 |

### 7.2 组合式 API

| API | 用途 | 备注 |
|---|---|---|
| `ref(init)` | 响应式值；脚本里读写要 `.value`，模板里自动解包 | 最常用 |
| `computed(() => …)` | 派生值，依赖变化才重算 | 依赖不变时返回缓存值 |
| `onMounted(fn)` | 组件挂载后执行（发首屏请求的地方） | 可安全访问 DOM 的最早时机 |
| `watch(source, cb)` | 显式监听变化 | — |
| `storeToRefs(store)` | 解构 store 保持响应性 | **必须手动 import**；方法不用它，直接 `store.fn()` |

### 7.3 TypeScript

| 语法 | 含义 |
|---|---|
| `interface TodoItem { id: number; … }` | 数据形状声明 |
| `ApiResult<T>` | 泛型信封 |
| `import type { X }` | 只导入类型（编译后擦除） |
| `ref<TodoItem[]>([])` | 泛型参数标注 ref 内部类型 |
| `request.body?.title` | 可选链：null/undefined 时安全返回 undefined |
| `String(x ?? '')` | 空值合并：null/undefined 用默认值 |
| `as unknown as RequestInstance` | 双重断言（特殊场景强制改类型），慎用 |

### 7.4 异步

| JS | 含义 |
|---|---|
| `async function` | 声明异步函数，返回值自动包装为 Promise |
| `await p` | 等待 Promise 完成，拿到结果值 |
| `try/catch/finally` | 异常处理；catch 不带类型时捕获一切 |
| `Promise.all([...])` | 并发等待多个 Promise 全部完成 |

---

## 八、新功能实现 Checklist

以"页面 + 接口"类需求为例（Todo 即按此流程实现）：

1. **页面**：`src/pages/<name>/index.vue` + `<route>` 块定 `name`（自动获得路由）
2. **API 层**：`src/api/<name>.ts`——先类型后函数，函数内用 `request<ApiResult<T>>(...)`
3. **共享类型**：信封复用 `@/api/types` 的 `ApiResult<T>`，勿重复定义
4. **Mock**：`mock/modules/<name>.mock.ts`，URL 带 `/api` 前缀；有状态数据放模块级变量
5. **Store**：需要跨页共享/持久化才建 `src/stores/modules/<name>.ts`，并在 `stores/index.ts` 导出
6. **文案**：`src/locales/{zh-CN,en-US,ko-KR}.json` 加 `navbar.<Name>` + 功能段
7. **入口**：首页 `menuItems` 或 `TabBar` 加跳转项
8. **验证**：`pnpm typecheck` → `pnpm lint`（用 `pnpm.cmd`）→ `pnpm dev` 手动走查

反模式提醒：
- ❌ api 层 import store（反向依赖）
- ❌ 手改 `src/types/*.d.ts`
- ❌ 文案写死中文（丢 `$t`）
- ❌ 列表 `v-for` 不带 `:key`

---

## 附：本文档相关 commit 约定

项目使用 Conventional Commits（feat/fix/docs/chore…），pre-commit 自动 lint，commit-msg 用 commitlint 校验。提交永远由开发者本人发起。
