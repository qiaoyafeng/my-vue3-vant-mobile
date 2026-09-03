<script setup lang="ts">
import type { FaceStartErrorType } from '@/composables/useFaceLandmarker'
import { showFailToast, showSuccessToast } from 'vant'
import { useFaceLandmarker } from '@/composables/useFaceLandmarker'

const { t } = useI18n()

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const { phase, startError, capturedFrames, targetFrames, start } = useFaceLandmarker(canvasRef)

// getUserMedia 硬性要求安全上下文，进页即检测并禁用按钮
const insecure = ref(!window.isSecureContext)

const phaseText = computed(() => t(`face.phase.${phase.value}`))
const progressText = computed(() => t('face.progress', { current: capturedFrames.value, total: targetFrames }))
const busy = computed(() => phase.value !== 'idle')

const ERROR_TOAST_KEY: Record<FaceStartErrorType, string> = {
  insecure: 'face.errorInsecure',
  denied: 'face.errorDenied',
  notFound: 'face.errorNotFound',
  unknown: 'face.errorUnknown',
  model: 'face.errorModel',
}

async function onStart() {
  if (!videoRef.value)
    return

  await start(videoRef.value)

  if (startError.value)
    showFailToast(t(ERROR_TOAST_KEY[startError.value]))
  else if (phase.value === 'done')
    showSuccessToast(t('face.uploadSuccess'))
  else if (phase.value === 'failed')
    showFailToast(t('face.uploadFail'))
}
</script>

<template>
  <van-notice-bar
    v-if="insecure"
    wrapable
    :scrollable="false"
    :text="t('face.errorInsecure')"
  />

  <div class="preview">
    <!-- scaleX(-1)：前置摄像头习惯性镜像，仅影响显示，不影响采集数据 -->
    <video ref="videoRef" class="preview-media" playsinline muted autoplay />
    <canvas ref="canvasRef" class="preview-media preview-canvas" />
    <div v-if="phase === 'idle' || phase === 'opening' || phase === 'loading'" class="preview-mask">
      {{ t('face.previewPlaceholder') }}
    </div>
  </div>

  <van-cell-group inset>
    <van-cell :title="t('face.progressLabel')" :value="progressText" />
    <van-cell :title="t('face.statusLabel')" :value="phaseText" />
  </van-cell-group>

  <div class="actions">
    <van-button
      type="primary"
      block
      :disabled="busy || insecure"
      :loading="phase === 'opening' || phase === 'loading' || phase === 'uploading'"
      @click="onStart"
    >
      {{ t('face.start') }}
    </van-button>
  </div>
</template>

<route lang="json5">
{
  name: 'Face'
}
</route>

<style scoped>
.preview {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 8px;
  background: var(--van-background-2);
}

.preview-media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.preview-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--van-text-color-2);
}

.actions {
  margin-top: 16px;
  padding: 0 4px;
}
</style>
