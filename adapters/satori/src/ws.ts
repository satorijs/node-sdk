import { Adapter, camelize, Context, HTTP, Logger, Schema, Time, Universal } from '@satorijs/core'
import { SatoriBot } from './bot'

export class SatoriAdapter<C extends Context = Context> extends Adapter.WsClientBase<C, SatoriBot<C>> {
  static schema = true as any
  static reusable = true
  static inject = ['http']

  public http: HTTP
  public logger: Logger

  private _status = Universal.Status.OFFLINE
  private sequence?: number
  private timeout?: NodeJS.Timeout

  private _metaDispose?: () => void

  constructor(public ctx: C, public config: SatoriAdapter.Config) {
    super(ctx, config)
    this.logger = ctx.logger('satori')
    this.http = ctx.http.extend({
      endpoint: config.endpoint,
      headers: {
        'Authorization': `Bearer ${config.token}`,
      },
    })
    ctx.on('ready', () => this.start())
    ctx.on('dispose', () => this.stop())
  }

  getActive() {
    return this._status !== Universal.Status.OFFLINE && this._status !== Universal.Status.DISCONNECT
  }

  setStatus(status: Universal.Status, error?: Error): void {
    this._status = status
    if (status === Universal.Status.ONLINE) return
    for (const bot of this.bots) {
      bot.status = status
      bot.error = error
    }
  }

  async prepare() {
    return this.http.ws('/v1/events')
  }

  getBot(platform: string, selfId: string, login: Universal.Login) {
    // Do not dispatch event from outside adapters.
    let bot = this.bots.find(bot => bot.selfId === selfId && bot.platform === platform)
    if (bot) {
      if (login) bot.update(login)
      return this.bots.includes(bot) ? bot : undefined
    }

    if (!login) {
      this.logger.error('cannot find bot for', platform, selfId)
      return
    }
    bot = new SatoriBot(this.ctx, login)
    this.bots.push(bot)
    bot.adapter = this
    bot.http = this.http.extend({
      headers: {
        'Satori-Platform': platform,
        'Satori-User-ID': selfId,
        'X-Platform': platform,
        'X-Self-ID': selfId,
      },
    })
    bot.status = login.status
  }

  accept() {
    this.socket.send(JSON.stringify({
      op: Universal.Opcode.IDENTIFY,
      body: {
        token: this.config.token,
        sn: this.sequence,
      },
    }))

    this.timeout = setInterval(() => {
      this.socket.send(JSON.stringify({
        op: Universal.Opcode.PING,
        body: {},
      }))
    }, Time.second * 10)

    this.socket.addEventListener('message', async ({ data }) => {
      let parsed: Universal.ServerPayload
      data = data.toString()
      try {
        parsed = Universal.transformKey(JSON.parse(data), camelize)
      } catch (error) {
        return this.logger.warn('cannot parse message', data)
      }

      if (parsed.op === Universal.Opcode.READY) {
        this.logger.debug('ready')
        for (const login of parsed.body.logins) {
          this.getBot(login.platform, login.user.id, login)
        }
        this._metaDispose = this.ctx.satori.proxyUrls.add(...parsed.body.proxyUrls ?? [])
      }

      if (parsed.op === Universal.Opcode.META) {
        this._metaDispose?.()
        this._metaDispose = this.ctx.satori.proxyUrls.add(...parsed.body.proxyUrls ?? [])
      }

      if (parsed.op === Universal.Opcode.EVENT) {
        const { sn, type, login, selfId = login?.user.id, platform = login?.platform } = parsed.body
        this.sequence = sn
        // `login-*` events will be dispatched by the bot,
        // so there is no need to create sessions manually.
        const bot = this.getBot(platform, selfId, type === 'login-added' && login)
        if (!bot) return
        if (type === 'login-updated') {
          return bot.update(login)
        } else if (type === 'login-removed') {
          return bot.dispose()
        }
        const session = bot.session(parsed.body)
        if (typeof parsed.body.message?.content === 'string') {
          const oldQuote = session.quote
          session.content = parsed.body.message.content
          if (oldQuote) session.quote = oldQuote
        }
        if (parsed.body._type && parsed.body.type !== 'internal') {
          session.setInternal(parsed.body._type, parsed.body._data)
        }
        bot.dispatch(session)
        // temporary solution for `send` event
        if (type === 'message-created' && session.userId === selfId) {
          session.app.emit(session, 'send', session)
        }
      }
    })

    this.socket.addEventListener('close', () => {
      clearInterval(this.timeout)
      this._metaDispose?.()
    })
  }

  async start() {
    this.setStatus(Universal.Status.CONNECT)
    await super.start()
  }

  async stop() {
    this.setStatus(Universal.Status.DISCONNECT)
    await super.stop()
  }
}

export namespace SatoriAdapter {
  export interface Config extends Adapter.WsClientConfig {
    endpoint: string
    token?: string
  }

  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      endpoint: Schema.string().description('API 终结点。').required(),
      token: Schema.string().description('API 访问令牌。'),
    }),
    Adapter.WsClientConfig,
  ] as const)
}
