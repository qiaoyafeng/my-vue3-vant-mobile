import request from '@/utils/request'
import type { ApiResult } from './types'

/** 人脸关键点：归一化坐标（0-1），序列化保留 5 位小数 */
export interface FaceLandmark {
  x: number
  y: number
  z: number
}

/** 表情系数单项（眨眼/张嘴/微笑等，共 52 项） */
export interface FaceBlendshape {
  categoryName: string
  score: number
}

/** 单帧采集结果：模型三类输出 + 时间戳 */
export interface FaceLandmarkFrame {
  timestampMs: number
  landmarks: FaceLandmark[]
  blendshapes: FaceBlendshape[]
  /** 4x4 头部姿态变换矩阵，列主序展开为长度 16 的数组 */
  facialTransformationMatrix: number[]
}

/** 一次采集会话（采满 targetFrameCount 帧后整体上传） */
export interface FaceLandmarkerSession {
  startedAt: string
  endedAt: string
  targetFrameCount: number
  frameCount: number
  videoWidth: number
  videoHeight: number
  frames: FaceLandmarkFrame[]
}

export function uploadFaceSession(session: FaceLandmarkerSession) {
  return request.post<ApiResult<{ id: string }>>('/face/sessions', session)
}
