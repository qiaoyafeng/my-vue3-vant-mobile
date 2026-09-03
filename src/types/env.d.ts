/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FACE_FRAME_COUNT?: string
  readonly VITE_OPENAI_BASE_URL?: string
  readonly VITE_OPENAI_MODEL?: string
  readonly VITE_OPENAI_SYSTEM_PROMPT?: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, never>, Record<string, never>, any>
  export default component
}
