import { Internal } from '../internal'
import { AilyKnowledgeAskProcessData, AilyKnowledgeFaq, AilyKnowledgeMessage, AilyMention, AilyMessage, AilyMessageContentType, AilySession, DataAsset, DataAssetTag, Run, Skill, SkillGlobalVariable } from '.'

declare module '../internal' {
  interface Internal {
    /**
     * 创建会话
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/aily_session/create
     */
    createAilyAilySession(body: CreateAilyAilySessionRequest): Promise<CreateAilyAilySessionResponse>
    /**
     * 更新会话
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/aily_session/update
     */
    updateAilyAilySession(aily_session_id: string, body: UpdateAilyAilySessionRequest): Promise<UpdateAilyAilySessionResponse>
    /**
     * 获取会话
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/aily_session/get
     */
    getAilyAilySession(aily_session_id: string): Promise<GetAilyAilySessionResponse>
    /**
     * 删除会话
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/aily_session/delete
     */
    deleteAilyAilySession(aily_session_id: string): Promise<void>
    /**
     * 发送智能伙伴消息
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/aily_session-aily_message/create
     */
    createAilyAilySessionAilyMessage(aily_session_id: string, body: CreateAilyAilySessionAilyMessageRequest): Promise<CreateAilyAilySessionAilyMessageResponse>
    /**
     * 获取智能伙伴消息
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/aily_session-aily_message/get
     */
    getAilyAilySessionAilyMessage(aily_session_id: string, aily_message_id: string): Promise<GetAilyAilySessionAilyMessageResponse>
    /**
     * 列出智能伙伴消息
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/aily_session-aily_message/list
     */
    listAilyAilySessionAilyMessage(aily_session_id: string, query?: ListAilyAilySessionAilyMessageQuery): Promise<ListAilyAilySessionAilyMessageResponse>
    /**
     * 创建运行
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/aily_session-run/create
     */
    createAilyAilySessionRun(aily_session_id: string, body: CreateAilyAilySessionRunRequest): Promise<CreateAilyAilySessionRunResponse>
    /**
     * 获取运行
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/aily_session-run/get
     */
    getAilyAilySessionRun(aily_session_id: string, run_id: string): Promise<GetAilyAilySessionRunResponse>
    /**
     * 列出运行
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/aily_session-run/list
     */
    listAilyAilySessionRun(aily_session_id: string, query?: ListAilyAilySessionRunQuery): Promise<ListAilyAilySessionRunResponse>
    /**
     * 取消运行
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/aily_session-run/cancel
     */
    cancelAilyAilySessionRun(aily_session_id: string, run_id: string): Promise<CancelAilyAilySessionRunResponse>
    /**
     * 调用技能
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/app-skill/start
     */
    startAilyAppSkill(app_id: string, skill_id: string, body: StartAilyAppSkillRequest): Promise<StartAilyAppSkillResponse>
    /**
     * 获取技能信息
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/app-skill/get
     */
    getAilyAppSkill(app_id: string, skill_id: string): Promise<GetAilyAppSkillResponse>
    /**
     * 查询技能列表
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/app-skill/list
     */
    listAilyAppSkill(app_id: string, query?: ListAilyAppSkillQuery): Promise<ListAilyAppSkillResponse>
    /**
     * 执行数据知识问答
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/app-knowledge/ask
     */
    askAilyAppKnowledge(app_id: string, body: AskAilyAppKnowledgeRequest): Promise<AskAilyAppKnowledgeResponse>
    /**
     * 查询数据知识列表
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/app-data_asset/list
     */
    listAilyAppDataAsset(app_id: string, query?: ListAilyAppDataAssetQuery): Promise<ListAilyAppDataAssetResponse>
    /**
     * 获取数据知识分类列表
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/aily-v1/app-data_asset_tag/list
     */
    listAilyAppDataAssetTag(app_id: string, query?: ListAilyAppDataAssetTagQuery): Promise<ListAilyAppDataAssetTagResponse>
  }
}

export interface CreateAilyAilySessionRequest {
  /** 渠道上下文 */
  channel_context?: string
  /** 其他透传信息 */
  metadata?: string
}

export interface UpdateAilyAilySessionRequest {
  /** 渠道上下文 */
  channel_context?: string
  /** 其他透传信息 */
  metadata?: string
}

export interface CreateAilyAilySessionAilyMessageRequest {
  /** 幂等id，同一 session 下相同的幂等 id 算一条消息，有效期72h */
  idempotent_id: string
  /** 消息内容类型 */
  content_type: AilyMessageContentType
  /** 消息内容 */
  content: string
  /** 消息中包含的文件 ID 列表 */
  file_ids?: string[]
  /** 引用的消息 ID */
  quote_message_id?: string
  /** 被@的实体 */
  mentions?: AilyMention[]
}

export interface ListAilyAilySessionAilyMessageQuery {
  /** 页面大小 */
  page_size?: number
  /** 分页偏移量 */
  page_token?: string
  /** 运行 ID */
  run_id?: string
  /** 返回生成中的消息 */
  with_partial_message?: boolean
}

export interface CreateAilyAilySessionRunRequest {
  /** 应用 ID */
  app_id: string
  /** 技能 ID */
  skill_id?: string
  /** 指定技能 ID 时可以同时指定技能输入 */
  skill_input?: string
  /** 其他透传信息 */
  metadata?: string
}

export interface ListAilyAilySessionRunQuery {
  /** 页面大小 */
  page_size?: number
  /** 分页偏移量 */
  page_token?: string
}

export interface StartAilyAppSkillRequest {
  /** 技能的全局变量 */
  global_variable?: SkillGlobalVariable
  /** 技能的自定义变量 */
  input?: string
}

export interface ListAilyAppSkillQuery {
  /** 页面大小 */
  page_size?: number
  /** 分页偏移量 */
  page_token?: string
}

export interface AskAilyAppKnowledgeRequest {
  /** 输入消息（当前仅支持纯文本输入） */
  message: AilyKnowledgeMessage
  /** 控制知识问答所依据的数据知识范围 */
  data_asset_ids?: string[]
  /** 控制知识问答所依据的数据知识分类范围 */
  data_asset_tag_ids?: string[]
}

export interface ListAilyAppDataAssetQuery {
  /** 分页参数：分页大小，默认：20，最大：100 */
  page_size?: number
  /** 分页参数：分页起始位置，为空表示首页 */
  page_token?: string
  /** 模糊匹配关键词 */
  keyword?: string
  /** 根据数据知识 ID 进行过滤 */
  data_asset_ids?: string[]
  /** 根据数据知识分类 ID 进行过滤 */
  data_asset_tag_ids?: string[]
  /** 结果是否包含数据与知识项目 */
  with_data_asset_item?: boolean
  /** 结果是否包含数据连接状态 */
  with_connect_status?: boolean
}

export interface ListAilyAppDataAssetTagQuery {
  /** 分页参数：分页大小，默认：20，最大：100 */
  page_size?: number
  /** 分页参数：分页起始位置，为空表示首页 */
  page_token?: string
  /** 模糊匹配分类名称 */
  keyword?: string
  /** 模糊匹配分类名称 */
  data_asset_tag_ids?: string[]
}

export interface CreateAilyAilySessionResponse {
  /** 创建的会话信息 */
  session?: AilySession
}

export interface UpdateAilyAilySessionResponse {
  /** 会话信息 */
  session?: AilySession
}

export interface GetAilyAilySessionResponse {
  /** 会话信息 */
  session?: AilySession
}

export interface CreateAilyAilySessionAilyMessageResponse {
  /** 消息信息 */
  message?: AilyMessage
}

export interface GetAilyAilySessionAilyMessageResponse {
  /** 消息信息 */
  message?: AilyMessage
}

export interface ListAilyAilySessionAilyMessageResponse {
  /** 消息列表 */
  messages?: AilyMessage[]
  /** 下一页的起始偏移量 */
  page_token?: string
  /** 是否还有更多数据 */
  has_more?: boolean
}

export interface CreateAilyAilySessionRunResponse {
  /** 运行信息 */
  run?: Run
}

export interface GetAilyAilySessionRunResponse {
  /** 运行信息 */
  run?: Run
}

export interface ListAilyAilySessionRunResponse {
  /** 运行列表 */
  runs?: Run[]
  /** 下一页的起始偏移量 */
  page_token?: string
  /** 是否还有更多数据 */
  has_more?: boolean
}

export interface CancelAilyAilySessionRunResponse {
  /** 运行信息 */
  run?: Run
}

export interface StartAilyAppSkillResponse {
  /** 技能的输出 */
  output?: string
  /** 技能的执行状态 */
  status?: string
}

export interface GetAilyAppSkillResponse {
  /** 技能信息 */
  skill?: Skill
}

export interface ListAilyAppSkillResponse {
  /** 技能列表 */
  skills?: Skill[]
  /** 下一页的起始偏移量 */
  page_token?: string
  /** 是否还有更多数据 */
  has_more?: boolean
}

export interface AskAilyAppKnowledgeResponse {
  /** 响应状态，枚举值 */
  status?: 'processing' | 'finished'
  /** 结束类型，枚举值 */
  finish_type?: 'qa' | 'faq'
  /** 响应消息 */
  message?: AilyKnowledgeMessage
  /** 知识问答运行过程结构化数据，status=finished 且 finish_type=qa 时返回 */
  process_data?: AilyKnowledgeAskProcessData
  /** 匹配标准问答对结果，status=finished 且 finish_type=faq时返回 */
  faq_result?: AilyKnowledgeFaq
  /** 是否有结果，true 则 代表 message 中的内容是通过配置知识而生成的 */
  has_answer?: boolean
}

export interface ListAilyAppDataAssetResponse {
  /** 数据知识列表 */
  items?: DataAsset[]
  /** has_more=true，可使用page_token继续查询 */
  page_token?: string
  /** 是否有更多 */
  has_more?: boolean
}

export interface ListAilyAppDataAssetTagResponse {
  /** 数据知识分类列表 */
  items?: DataAssetTag[]
  /** has_more=true，可使用 page_token继续查询 */
  page_token?: string
  /** 是否有更多 */
  has_more?: boolean
}

Internal.define({
  '/open-apis/aily/v1/sessions': {
    POST: 'createAilyAilySession',
  },
  '/open-apis/aily/v1/sessions/{aily_session_id}': {
    PUT: 'updateAilyAilySession',
    GET: 'getAilyAilySession',
    DELETE: 'deleteAilyAilySession',
  },
  '/open-apis/aily/v1/sessions/{aily_session_id}/messages': {
    POST: 'createAilyAilySessionAilyMessage',
    GET: 'listAilyAilySessionAilyMessage',
  },
  '/open-apis/aily/v1/sessions/{aily_session_id}/messages/{aily_message_id}': {
    GET: 'getAilyAilySessionAilyMessage',
  },
  '/open-apis/aily/v1/sessions/{aily_session_id}/runs': {
    POST: 'createAilyAilySessionRun',
    GET: 'listAilyAilySessionRun',
  },
  '/open-apis/aily/v1/sessions/{aily_session_id}/runs/{run_id}': {
    GET: 'getAilyAilySessionRun',
  },
  '/open-apis/aily/v1/sessions/{aily_session_id}/runs/{run_id}/cancel': {
    POST: 'cancelAilyAilySessionRun',
  },
  '/open-apis/aily/v1/apps/{app_id}/skills/{skill_id}/start': {
    POST: 'startAilyAppSkill',
  },
  '/open-apis/aily/v1/apps/{app_id}/skills/{skill_id}': {
    GET: 'getAilyAppSkill',
  },
  '/open-apis/aily/v1/apps/{app_id}/skills': {
    GET: 'listAilyAppSkill',
  },
  '/open-apis/aily/v1/apps/{app_id}/knowledges/ask': {
    POST: 'askAilyAppKnowledge',
  },
  '/open-apis/aily/v1/apps/{app_id}/data_assets': {
    GET: 'listAilyAppDataAsset',
  },
  '/open-apis/aily/v1/apps/{app_id}/data_asset_tags': {
    GET: 'listAilyAppDataAssetTag',
  },
})
