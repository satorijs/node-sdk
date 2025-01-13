import { Binary, Bot, Context, Dict, h, HTTP, Schema, Time, Universal } from '@satorijs/core'
import { pathToFileURL } from 'url'
import * as Telegram from './types'
import { decodeGuildMember, decodeUser } from './utils'
import { TelegramMessageEncoder } from './message'
import { HttpServer } from './server'
import { HttpPolling } from './polling'
import FileType from 'file-type'

export class SenderError extends Error {
  constructor(args: Dict<any>, url: string, retcode: number, selfId: string) {
    super(`Error when trying to send to ${url}, args: ${JSON.stringify(args)}, retcode: ${retcode}`)
    Object.defineProperties(this, {
      name: { value: 'SenderError' },
      selfId: { value: selfId },
      code: { value: retcode },
      args: { value: args },
      url: { value: url },
    })
  }
}

export interface TelegramResponse {
  ok: boolean
  result: any
}

export class TelegramBot<C extends Context = Context, T extends TelegramBot.Config = TelegramBot.Config> extends Bot<C, T> {
  static MessageEncoder = TelegramMessageEncoder
  static inject = ['http']

  http: HTTP
  file: HTTP
  internal: Telegram.Internal
  local?: boolean
  server?: string

  constructor(ctx: C, config: T) {
    super(ctx, config, 'telegram')
    this.selfId = config.token.split(':')[0]
    this.local = config.files.local
    this.http = this.ctx.http.extend({
      ...config,
      endpoint: `${config.endpoint}/bot${config.token}`,
    })
    this.file = this.ctx.http.extend({
      ...config,
      endpoint: `${config.files.endpoint || config.endpoint}/file/bot${config.token}`,
    })
    this.internal = new Telegram.Internal(this)
    if (config.protocol === 'server') {
      ctx.plugin(HttpServer, this)
    } else if (config.protocol === 'polling') {
      ctx.plugin(HttpPolling, this)
    }
    const selfUrl: string = config['selfUrl'] || ctx.get('server')?.config.selfUrl
    if (config.files.server ?? selfUrl) {
      const route = `/telegram/${this.selfId}`
      this.server = selfUrl + route
      ctx.get('server').get(route + '/:file(.+)', async ctx => {
        const { data, type } = await this.$getFile(ctx.params.file)
        ctx.set('content-type', type)
        ctx.body = Buffer.from(data)
      })
    }
  }

  async initialize(callback: (bot: this) => Promise<void>) {
    await this.getLogin()
    await callback(this)
    this.logger.debug('connected to %c', 'telegram:' + this.selfId)
    this.online()
  }

  async deleteMessage(chat_id: string, message_id: string | number) {
    message_id = +message_id
    await this.internal.deleteMessage({ chat_id, message_id })
  }

  async editMessage(chat_id: string, message_id: string | number, content: h.Fragment): Promise<void> {
    message_id = +message_id
    const payload: Telegram.EditMessageTextPayload = {
      chat_id,
      message_id,
      parse_mode: 'html',
    }
    payload.text = h.normalize(content).join('')
    await this.internal.editMessageText(payload)
  }

  static adaptGroup(data: Telegram.Chat): Universal.Guild {
    data['guildId'] = data.id + ''
    data['guildName'] = data.title
    return data as any
  }

  async getGuild(chat_id: string): Promise<Universal.Guild> {
    const data = await this.internal.getChat({ chat_id })
    return TelegramBot.adaptGroup(data)
  }

  async getGuildMember(chat_id: string, user_id: string | number) {
    user_id = +user_id
    if (Number.isNaN(user_id)) return null
    const data = await this.internal.getChatMember({ chat_id, user_id })
    const member = decodeGuildMember(data)
    await this.setAvatarUrl(member.user)
    return member
  }

  async getGuildMemberList(chat_id: string) {
    const data = await this.internal.getChatAdministrators({ chat_id })
    const members = data.map(decodeGuildMember)
    return { data: members }
  }

  async kickGuildMember(chat_id: string, user_id: string | number, permanent?: boolean) {
    user_id = +user_id
    await this.internal.banChatMember({
      chat_id,
      user_id,
      until_date: Date.now() + (permanent ? 0 : Time.minute),
      revoke_messages: true,
    })
  }

  setGroupLeave(chat_id: string) {
    return this.internal.leaveChat({ chat_id })
  }

  async handleGuildMemberRequest(messageId: string, approve: boolean, comment?: string) {
    const [chat_id, user_id] = messageId.split('@')
    const method = approve ? 'approveChatJoinRequest' : 'declineChatJoinRequest'
    const success = await this.internal[method]({ chat_id, user_id: +user_id })
    if (!success) throw new Error(`handel guild member request field ${success}`)
  }

  async getLogin() {
    const data = await this.internal.getMe()
    const user = decodeUser(data)
    await this.setAvatarUrl(user)
    this.user = user
    return this.toJSON()
  }

  async $getFile(filePath: string) {
    if (this.local) {
      return await this.ctx.http.file(pathToFileURL(filePath).href)
    } else {
      return await this.file.file(`/${filePath}`)
    }
  }

  async $getFileFromId(file_id: string) {
    try {
      const file = await this.internal.getFile({ file_id })
      return await this.$getFileFromPath(file.file_path)
    } catch (e) {
      this.logger.warn('get file error', e)
    }
  }

  async $getFileFromPath(filePath: string) {
    if (this.server) {
      return { src: `${this.server}/${filePath}` }
    }
    let { type, data } = await this.$getFile(filePath)
    if (type === 'application/octet-stream') {
      type = (await FileType.fromBuffer(data))?.mime
    }
    const base64 = `data:${type};base64,` + Binary.toBase64(data)
    return { src: base64 }
  }

  private async setAvatarUrl(user: Universal.User) {
    const { photos: [avatar] } = await this.internal.getUserProfilePhotos({ user_id: +user.id })
    if (!avatar) return
    const { file_id } = avatar[avatar.length - 1]
    const file = await this.internal.getFile({ file_id })
    if (this.local || this.server) {
      user.avatar = (await this.$getFileFromPath(file.file_path)).src
    } else {
      const { endpoint } = this.file.config
      user.avatar = `${endpoint}/${file.file_path}`
    }
  }

  async getUser(userId: string, guildId?: string) {
    const data = await this.internal.getChat({ chat_id: userId })
    if (!data.photo?.big_file_id && !data.photo?.small_file_id) return decodeUser(data)
    const { src } = await this.$getFileFromId(data.photo?.big_file_id || data.photo?.small_file_id)
    return {
      ...decodeUser(data),
      avatar: src,
    }
  }

  async createDirectChannel(id: string) {
    return { id, type: Universal.Channel.Type.DIRECT }
  }

  async updateCommands(commands: Universal.Command[]) {
    if (!this.config.slash) return
    commands = commands.filter((command) => {
      // https://core.telegram.org/bots/api#botcommand
      return /^[\w-]{1,32}$/g.test(command.name)
    })
    const result = {} as Record<string, Telegram.BotCommand[]>
    for (const cmd of commands) {
      const { name, description } = cmd
      const languages = {} as Record<string, string>
      for (const locale in description) {
        if (!locale || !description[locale]) continue
        const lang = locale.slice(0, 2)
        languages[lang] ||= description[locale]
      }
      for (const lang in languages) {
        (result[lang] ??= []).push({
          command: name.toLowerCase().replace(/[^\w]/g, '_'),
          description: languages[lang],
        })
      }
    }
    for (const lang in result) {
      await this.internal.setMyCommands({
        commands: result[lang],
        language_code: lang,
      })
    }
    await this.internal.setMyCommands({
      commands: commands.map(({ name, description }) => ({
        command: name.toLowerCase().replace(/[^\w]/g, '_'),
        description: description[''] || name,
      })),
    })
  }
}

export namespace TelegramBot {
  export interface BaseConfig extends HTTP.Config {
    protocol: 'server' | 'polling'
    token: string
    files?: Config.Files
    slash?: boolean
  }

  export type Config = BaseConfig & (HttpServer.Options | HttpPolling.Options)

  export namespace Config {
    export interface Files {
      endpoint?: string
      local?: boolean
      server?: boolean
    }
  }

  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      token: Schema.string().description('机器人的用户令牌。').role('secret').required(),
      protocol: process.env.KOISHI_ENV === 'browser'
        ? Schema.const('polling').default('polling')
        : Schema.union(['server', 'polling']).description('选择要使用的协议。').required(),
    }),
    Schema.union([
      HttpServer.Options,
      HttpPolling.Options,
    ]).description('推送设置'),
    Schema.object({
      slash: Schema.boolean().description('是否启用斜线指令。').default(true),
    }).description('功能设置'),
    HTTP.createConfig('https://api.telegram.org'),
    Schema.object({
      files: Schema.object({
        endpoint: Schema.string().description('文件请求的终结点。'),
        local: Schema.boolean().description('是否启用 [Telegram Bot API](https://github.com/tdlib/telegram-bot-api) 本地模式。'),
        server: Schema.boolean().description('是否启用文件代理。若开启将会使用 `selfUrl` 进行反代，否则会下载所有资源文件 (包括图片、视频等)。当配置了 `selfUrl` 时将默认开启。'),
      }),
    }).hidden(process.env.KOISHI_ENV === 'browser').description('文件设置'),
  ] as const)
}
