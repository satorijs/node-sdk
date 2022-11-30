import { createReadStream } from 'fs'
import internal from 'stream'

import { Bot, Context } from '@satorijs/core'
import { Logger, Quester, Schema, segment } from '@satorijs/satori'
import FormData from 'form-data'

import { FeishuMessenger } from './message'
import { HttpServer } from './http'
import { Internal, MessageContent, MessagePayload, MessageType } from './types'
import { extractIdType } from './utils'

type AssetType = 'image' | 'audio' | 'video' | 'file'

const logger = new Logger('feishu')

export class FeishuBot extends Bot<FeishuBot.Config> {
  _token?: string
  http: Quester
  assetsQuester: Quester
  internal?: Internal

  constructor(ctx: Context, config: FeishuBot.Config) {
    super(ctx, config)

    // feishu bot needs config.selfUrl to be set as it should be serve on a public url
    if (!config.selfUrl && !ctx.config.selfUrl) {
      logger.warn('selfUrl is not set, some features may not work')
    }

    this.selfId = config.appId

    this.http = ctx.http.extend({
      endpoint: config.endpoint ?? 'https://open.feishu.cn/open-apis/',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
    this.assetsQuester = Quester.create()

    this.internal = new Internal(this.http)

    ctx.plugin(HttpServer, this)
  }

  async initialize(): Promise<void> {
    await this.refreshToken()
    this.online()
  }

  private async refreshToken(): Promise<void> {
    const { tenant_access_token: token } = await this.internal.getTenantAccessToken({
      app_id: this.config.appId,
      app_secret: this.config.appSecret,
    })
    logger.debug('refreshed token %s', token)
    this.token = token
    this.online()
  }

  get token() {
    return this._token
  }

  set token(v: string) {
    this._token = v
    this.http.config.headers.Authorization = `Bearer ${v}`
  }

  async sendMessage(channelId: string, content: string, guildId?: string): Promise<string[]> {
    return new FeishuMessenger(this, channelId, guildId).send(content)
  }

  async sendPrivateMessage(userId: string, content: string): Promise<string[]> {
    return this.sendMessage(userId, content)
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    await this.internal.deleteMessage(messageId)
  }

  private async _prepareAssets(type: AssetType, data: { url: string }): Promise<MessageContent.Contents> {
    const payload = new FormData()

    const assetKey = type === 'image' ? 'image' : 'file'
    const [schema, file] = data.url.split('://')
    const filename = schema === 'base64' ? 'unknown' : new URL(data.url).pathname.split('/').pop()
    if (schema === 'file') {
      payload.append(assetKey, createReadStream(file))
    } else if (schema === 'base64') {
      payload.append(assetKey, Buffer.from(file, 'base64'))
    } else {
      const resp = await this.assetsQuester.get<internal.Readable>(data.url, { responseType: 'stream' })
      payload.append(assetKey, resp)
    }

    if (type === 'image') {
      payload.append('image_type', 'message')
      const { data } = await this.internal.uploadImage(payload)
      return { image_key: data.image_key }
    } else {
      if (type === 'audio') {
        payload.append('file_type', 'opus')
      } else if (type === 'video') {
        payload.append('file_type', 'mp4')
      } else {
        const ext = filename.split('.').pop()
        if (['xls', 'ppt', 'pdf'].includes(ext)) {
          payload.append('file_type', ext)
        } else {
          payload.append('file_type', 'stream')
        }
      }
      payload.append('file_name', filename)
      const { data } = await this.internal.uploadFile(payload)
      return { file_key: data.file_key }
    }
  }
}

export namespace FeishuBot {
  export interface Config extends Bot.Config, HttpServer.Config, Quester.Config {
    path?: string
    appId: string
    appSecret: string
    encryptKey?: string
  }

  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      path: Schema.string().role('url').description('要连接的服务器地址。').default('/feishu'),
      appId: Schema.string().required().description('机器人的应用 ID。'),
      appSecret: Schema.string().role('secret').required().description('机器人的应用密钥。'),
      encryptKey: Schema.string().role('secret').description('机器人的 Encrypt Key。'),
    }),
    Quester.Config,
    HttpServer.Config,
  ])

  export namespace Message {
    export interface Text {
      text: string
    }
    export interface Image {
      image_key: string
    }
    export interface Audio {
      file_key: string
    }
    export interface Media {
      file_key: string
      image_key?: string
    }
    export interface File {
      file_key: string
    }
    export interface Content {
      receive_id?: string
      msg_type: MessageType
    }
    export type Contents<T extends MessageType> = Content & (
      T extends 'text' ? Text :
      T extends 'image' ? Image :
      T extends 'audio' ? Audio :
      T extends 'media' ? Media :
      T extends 'file' ? File :
      Content
    )
    export type FileContents = Content & (Image | Audio | Media | File)
    export function extractContentsType<T extends MessageType>(
      type: T, data: Contents<MessageType>
    // @ts-ignore
    ): data is Contents<T> {
      return data.msg_type === type
    }
  }
}

FeishuBot.prototype.platform = 'feishu'