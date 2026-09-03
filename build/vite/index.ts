import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { unheadVueComposablesImports } from '@unhead/vue'
import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { VantResolver } from '@vant/auto-import-resolver'
import Components from 'unplugin-vue-components/vite'
import { VueRouterAutoImports } from 'vue-router/unplugin'
import VueRouter from 'vue-router/vite'
import { mockDevServerPlugin } from 'vite-plugin-mock-dev-server'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { VitePWA } from 'vite-plugin-pwa'
import Sitemap from 'vite-plugin-sitemap'
import VueDevTools from 'vite-plugin-vue-devtools'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { loadEnv } from 'vite'
import { createViteVConsole } from './vconsole.ts'

const VUE_COMPONENT_INCLUDE = [/\.vue$/, /\.vue\?vue/]
const AUTO_IMPORT_INCLUDE = [
  /\.[tj]sx?$/,
  /\.vue$/,
  /\.vue\?vue/,
]

export function createVitePlugins(mode: string) {
  const env = loadEnv(mode, process.cwd())

  return [
    VueRouter({
      extensions: ['.vue'],
      routesFolder: 'src/pages',
      dts: 'src/types/route-map.d.ts',
    }),

    vue(),

    // https://github.com/jbaubree/vite-plugin-sitemap
    Sitemap({
      outDir: env.VITE_APP_OUT_DIR || 'dist',
    }),

    // https://github.com/pengzhanbo/vite-plugin-mock-dev-server
    // face 会话 JSON 约 1-2MB，放宽 co-body 默认 1mb 的 json 限制
    mockDevServerPlugin({ bodyParserOptions: { jsonLimit: '10mb' } }),

    // 将 MediaPipe WASM 从 node_modules 复制为静态资产（dev 与 build 均生效）
    // stripBase: 扁平复制，去掉 src 的目录层级，使 /wasm/* 直接可访问
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@mediapipe/tasks-vision/wasm/*',
          dest: 'wasm',
          rename: { stripBase: true },
        },
      ],
    }),

    // https://github.com/antfu/unplugin-vue-components
    Components({
      extensions: ['vue'],
      resolvers: [VantResolver()],
      include: VUE_COMPONENT_INCLUDE,
      dts: 'src/types/components.d.ts',
    }),

    // https://github.com/antfu/unplugin-auto-import
    AutoImport({
      include: AUTO_IMPORT_INCLUDE,
      imports: [
        'vue',
        '@vueuse/core',
        VueRouterAutoImports,
        {
          'vue-router/auto': ['useLink'],
          '@/utils/i18n': ['i18n', 'locale'],
          'vue-i18n': ['useI18n'],
        },
        unheadVueComposablesImports,
      ],
      dts: 'src/types/auto-imports.d.ts',
      dirs: [
        'src/composables',
      ],
      resolvers: [VantResolver()],
    }),

    // https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n
    VueI18nPlugin({
      // locale messages resource pre-compile option
      include: resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales/**'),
    }),

    legacy({
      targets: ['defaults', 'not IE 11'],
    }),

    // https://github.com/antfu/unocss
    // see uno.config.ts for config
    UnoCSS(),

    // https://github.com/vadxq/vite-plugin-vconsole
    createViteVConsole(mode),

    // https://github.com/vuejs/devtools-next
    VueDevTools(),

    // https://github.com/antfu/vite-plugin-pwa
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'safari-pinned-tab.svg'],
      manifest: {
        name: 'vue3-vant-mobile',
        short_name: 'vue3-vant-mobile',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ]
}
