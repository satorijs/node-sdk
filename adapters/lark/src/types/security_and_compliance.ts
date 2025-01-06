import { Internal } from '../internal'
import { OpenapiLog } from '.'

declare module '../internal' {
  interface Internal {
    /**
     * 获取OpenAPI审计日志数据
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/security_and_compliance-v1/openapi_log/list_data
     */
    listDataSecurityAndComplianceOpenapiLog(body: ListDataSecurityAndComplianceOpenapiLogRequest): Promise<ListDataSecurityAndComplianceOpenapiLogResponse>
  }
}

export interface ListDataSecurityAndComplianceOpenapiLogRequest {
  /** 飞书开放平台定义的API */
  api_keys?: string[]
  /** 以秒为单位的起始时间戳 */
  start_time?: number
  /** 以秒为单位的终止时间戳 */
  end_time?: number
  /** 在开发者后台——凭证与基础信息页面查看的app_id（cli_xxx），指调用openapi的应用 */
  app_id?: string
  /** 分页大小 */
  page_size?: number
  /** 分页标记，第一次请求不填，表示从头开始遍历；当返回的has_more为true时，会返回新的page_token，再次调用接口，传入这个page_token，将获得下一页数据 */
  page_token?: string
}

export interface ListDataSecurityAndComplianceOpenapiLogResponse {
  /** openapi日志列表 */
  items?: OpenapiLog[]
  /** 分页标记 */
  page_token?: string
  /** 是否有更多数据 */
  has_more?: boolean
}

Internal.define({
  '/open-apis/security_and_compliance/v1/openapi_logs/list_data': {
    POST: 'listDataSecurityAndComplianceOpenapiLog',
  },
})
