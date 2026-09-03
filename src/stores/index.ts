import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

import useUserStore from './modules/user'
import useCounterStore from './modules/counter'
import useRouteCacheStore from './modules/routeCache'
import useTodoStore from './modules/todo'
import useChatStore from './modules/chat'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

export { useUserStore, useCounterStore, useRouteCacheStore, useTodoStore, useChatStore }
export default pinia
