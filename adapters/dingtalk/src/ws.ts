import { Adapter, Schema } from '@satorijs/satori'
import { DingtalkBot } from './bot'
import { decodeMessage } from './utils'

export class WsClient extends Adapter.WsClient<DingtalkBot> {
  async prepare() {
    await this.bot.refreshToken()
    await this.bot.getLogin()
    const { endpoint, ticket } = await this.bot.http.post<{
      endpoint: string
      ticket: string
    }>('/gateway/connections/open', {
      clientId: this.bot.config.appkey,
      clientSecret: this.bot.config.secret,
      subscriptions: [
        {
          type: 'CALLBACK',
          topic: '/v1.0/im/bot/messages/get',
        },
      ],
    })
    return this.bot.http.ws(`${endpoint}?ticket=${ticket}`)
  }

  accept() {
    this.bot.online()
    this.socket.addEventListener('message', async ({ data }) => {
      const parsed = JSON.parse(data.toString())
      this.ctx.logger('dingtalk').debug(parsed)
      if (parsed.type === 'SYSTEM') {
        if (parsed.headers.topic === 'ping') {
          this.socket.send(JSON.stringify({
            code: 200,
            headers: parsed.headers,
            message: 'OK',
            data: parsed.data,
          }))
        }
      } else if (parsed.type === 'CALLBACK') {
        this.ctx.logger('dingtalk').debug(JSON.parse(parsed.data))
        const session = await decodeMessage(this.bot, JSON.parse(parsed.data))
        if (session) this.bot.dispatch(session)
        this.ctx.logger('dingtalk').debug(session)
      }
    })
  }
}

export namespace WsClient {
  export interface Config extends Adapter.WsClientConfig {}

  export const Config: Schema<Config> = Schema.intersect([
    Adapter.WsClientConfig,
  ] as const)
}
