import { onUnmounted, ref } from 'vue'

/** 摄像头开启失败分类，null 表示成功 */
export type FaceCameraErrorType = 'insecure' | 'denied' | 'notFound' | 'unknown'

/**
 * 摄像头生命周期：开启（前置优先 640x480）、关闭、尺寸读取。
 * 组件卸载时自动停止所有轨道，避免摄像头指示灯常亮。
 */
export function useFaceCamera() {
  const videoSize = ref({ width: 0, height: 0 })
  let stream: MediaStream | null = null

  function close() {
    stream?.getTracks().forEach(track => track.stop())
    stream = null
  }

  async function open(video: HTMLVideoElement): Promise<FaceCameraErrorType | null> {
    close() // 防止重复开启导致轨道泄漏

    // getUserMedia 硬性要求安全上下文（HTTPS 或 localhost）
    if (!window.isSecureContext)
      return 'insecure'
    if (!navigator.mediaDevices?.getUserMedia)
      return 'unknown'

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      video.srcObject = stream
      await video.play()

      // 等首帧数据就绪，保证 videoWidth/videoHeight 可用
      if (video.readyState < 2) {
        await new Promise<void>((resolve) => {
          video.onloadeddata = () => resolve()
        })
      }
      videoSize.value = { width: video.videoWidth, height: video.videoHeight }
      return null
    }
    catch (err) {
      close()
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError')
        return 'denied'
      if (name === 'NotFoundError' || name === 'OverconstrainedError')
        return 'notFound'
      return 'unknown'
    }
  }

  onUnmounted(close)

  return { open, close, videoSize }
}
