/**
 * 后端接口的统一响应信封。
 * 所有接口返回 { code, msg, data }，业务数据在 data 中。
 */
export interface ApiResult<T> {
  code: number
  msg: string
  data: T
}
