import type { Ref } from 'vue'
import { DrawingUtils, FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { onUnmounted, ref } from 'vue'
import type { FaceLandmarkerSession } from '@/api/face'
import { uploadFaceSession } from '@/api/face'
import { useFaceCamera } from './useFaceCamera'

/** 采集帧数环境变量非法时的兜底值 */
const DEFAULT_FRAME_COUNT = 100

function resolveFrameCount(): number {
  const raw = Number(import.meta.env.VITE_FACE_FRAME_COUNT)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_FRAME_COUNT
}

function round5(v: number): number {
  return Math.round(v * 1e5) / 1e5
}

/** 会话全流程阶段；idle 之外按钮一律禁用（一次性流程） */
export type FacePhase = 'idle' | 'opening' | 'loading' | 'running' | 'uploading' | 'done' | 'failed'

/** 开启阶段失败分类（insecure/denied/notFound/unknown 映射自 useFaceCamera；model 为模型/WASM 加载失败） */
export type FaceStartErrorType = 'insecure' | 'denied' | 'notFound' | 'unknown' | 'model'

/**
 * Face 模块核心编排：模型加载 → rAF 推理循环 → canvas 叠加绘制 → 帧缓冲
 * → 采满 targetFrameCount 自动上传。
 * 打开摄像头即开始采集；上传完成/失败即流程结束（设计：一次性流程）。
 */
export function useFaceLandmarker(canvasRef: Ref<HTMLCanvasElement | null>) {
  const camera = useFaceCamera()

  const phase = ref<FacePhase>('idle')
  const startError = ref<FaceStartErrorType | null>(null)
  const capturedFrames = ref(0)
  const targetFrames = resolveFrameCount()

  let landmarker: FaceLandmarker | null = null
  let drawingUtils: DrawingUtils | null = null
  let rafId = 0
  let running = false
  let lastVideoTime = -1
  let startedAt = ''
  let frames: FaceLandmarkerSession['frames'] = []

  async function loadModel() {
    const fileset = await FilesetResolver.forVisionTasks('/wasm')
    const buildOptions = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate },
      runningMode: 'VIDEO' as const,
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    })
    // GPU delegate 在部分浏览器/驱动不可用，失败回退 CPU
    try {
      landmarker = await FaceLandmarker.createFromOptions(fileset, buildOptions('GPU'))
    }
    catch {
      landmarker = await FaceLandmarker.createFromOptions(fileset, buildOptions('CPU'))
    }
  }

  function stopLoop() {
    running = false
    cancelAnimationFrame(rafId)
  }

  function loop(video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    if (!running || !landmarker)
      return

    // 以视频帧推进为条件推理，避免对同一帧重复 detect
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime
      const result = landmarker.detectForVideo(video, performance.now())

      // 清屏用原生 clearRect（官方 demo 写法，DrawingUtils 无 clear 方法）
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const face = result.faceLandmarks[0]
      if (face) {
        drawingUtils?.drawConnectors(face, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: '#C0C0C070', lineWidth: 1 })
        // 关键点：绿色，radius 略大于网格线宽（1px）；radius 默认 6px 过大，必须显式覆盖
        drawingUtils?.drawLandmarks(face, { color: '#00E676', lineWidth: 0.5, radius: 1.5 })
      }

      // detectForVideo 复用 result 对象，缓冲前必须拷贝
      if (face && frames.length < targetFrames) {
        frames.push({
          timestampMs: performance.now(),
          landmarks: face.map(p => ({ x: round5(p.x), y: round5(p.y), z: round5(p.z) })),
          blendshapes: (result.faceBlendshapes?.[0]?.categories ?? [])
            .map(c => ({ categoryName: c.categoryName, score: round5(c.score) })),
          facialTransformationMatrix: Array.from(result.facialTransformationMatrixes?.[0]?.data ?? []),
        })
        capturedFrames.value = frames.length

        if (frames.length >= targetFrames) {
          void finish()
          return
        }
      }
    }
    rafId = requestAnimationFrame(() => loop(video, canvas, ctx))
  }

  async function finish() {
    stopLoop()
    camera.close()

    const session: FaceLandmarkerSession = {
      startedAt,
      endedAt: new Date().toISOString(),
      targetFrameCount: targetFrames,
      frameCount: frames.length,
      videoWidth: camera.videoSize.value.width,
      videoHeight: camera.videoSize.value.height,
      frames,
    }
    frames = []
    landmarker?.close()
    landmarker = null

    phase.value = 'uploading'
    try {
      await uploadFaceSession(session)
      phase.value = 'done'
    }
    catch {
      phase.value = 'failed'
    }
  }

  async function start(video: HTMLVideoElement): Promise<void> {
    if (phase.value !== 'idle' || !canvasRef.value)
      return

    startError.value = null
    phase.value = 'opening'
    const camErr = await camera.open(video)
    if (camErr) {
      startError.value = camErr
      phase.value = 'idle'
      return
    }

    phase.value = 'loading'
    try {
      await loadModel()
    }
    catch {
      startError.value = 'model'
      camera.close()
      phase.value = 'idle'
      return
    }

    const canvas = canvasRef.value
    canvas.width = camera.videoSize.value.width
    canvas.height = camera.videoSize.value.height
    drawingUtils = new DrawingUtils(canvas.getContext('2d')!)

    frames = []
    capturedFrames.value = 0
    startedAt = new Date().toISOString()
    lastVideoTime = -1
    running = true
    phase.value = 'running'
    rafId = requestAnimationFrame(() => loop(video, canvas, canvas.getContext('2d')!))
  }

  onUnmounted(() => {
    stopLoop()
    camera.close()
    drawingUtils = null
    landmarker?.close()
    landmarker = null
  })

  return { phase, startError, capturedFrames, targetFrames, start }
}
