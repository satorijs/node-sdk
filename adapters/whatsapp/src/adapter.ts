import { Adapter, Context, Logger, Quester, remove, Schema } from '@satorijs/satori'
import { Internal } from './internal'
import { WhatsAppBot } from './bot'
import { WebhookBody } from './types'
import { decodeMessage } from './utils'
import internal from 'stream'
import crypto from 'crypto'

class HttpServer {
  private logger = new Logger('whatsapp')
  private adapters: WhatsAppAdapter[] = []

  constructor(private ctx: Context) {
    // https://developers.facebook.com/docs/graph-api/webhooks/getting-started
    // https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-whatsapp/
    ctx.router.post('/whatsapp', async (ctx) => {
      const received = ctx.get('X-Hub-Signature-256').split('sha256=')[1]
      if (!received) return ctx.status = 403

      const payload = ctx.request.rawBody
      const adapters = this.adapters.filter((adapter) => {
        const expected = crypto
          .createHmac('sha256', adapter.config.secret)
          .update(payload)
          .digest('hex')
        return expected === received
      })
      if (!adapters.length) return ctx.status = 403

      const parsed = ctx.request.body as WebhookBody
      this.logger.debug(parsed)
      ctx.body = 'ok'
      ctx.status = 200
      if (parsed.object !== 'whatsapp_business_account') return
      for (const entry of parsed.entry) {
        const phone_number_id = entry.changes[0].value.metadata.phone_number_id
        const bot = this.getBot(phone_number_id)
        const session = await decodeMessage(bot, entry)
        if (session.length) session.forEach(bot.dispatch.bind(bot))
        this.logger.debug('handling bot: %s', bot.sid)
        this.logger.debug(session)
      }
    })

    ctx.router.get('/whatsapp', async (ctx) => {
      this.logger.debug(ctx.query)
      const verifyToken = ctx.query['hub.verify_token']
      const challenge = ctx.query['hub.challenge']
      for (const adapter of this.adapters) {
        if (adapter.config.verifyToken === verifyToken) {
          ctx.body = challenge
          ctx.status = 200
          return
        }
      }
      return ctx.status = 403
    })

    ctx.router.get('/whatsapp/assets/:self_id/:media_id', async (ctx) => {
      const mediaId = ctx.params.media_id
      const selfId = ctx.params.self_id
      const bot = this.getBot(selfId)
      if (!bot) return ctx.status = 404

      const fetched = await bot.internal.getMedia(mediaId)
      this.logger.debug(fetched.url)
      const resp = await bot.ctx.http.axios<internal.Readable>({
        url: fetched.url,
        method: 'GET',
        responseType: 'stream',
      })
      ctx.type = resp.headers['content-type']
      ctx.set('cache-control', resp.headers['cache-control'])
      ctx.response.body = resp.data
      ctx.status = 200
    })
  }

  getBot(selfId: string) {
    for (const adapter of this.adapters) {
      for (const bot of adapter.bots) {
        if (bot.selfId === selfId) return bot
      }
    }
  }

  fork(ctx: Context, adapter: WhatsAppAdapter) {
    this.adapters.push(adapter)
    ctx.on('dispose', () => {
      remove(this.adapters, adapter)
    })
  }
}

export class WhatsAppAdapter extends Adapter<WhatsAppBot> {
  static schema = true
  static reusable = true

  public bots: WhatsAppBot[] = []

  constructor(ctx: Context, public config: WhatsAppAdapter.Config) {
    super()
    ctx.plugin(HttpServer, this)

    const http = ctx.http.extend({
      headers: {
        Authorization: `Bearer ${config.systemToken}`,
      },
    }).extend(config)
    const internal = new Internal(http)

    ctx.on('ready', async () => {
      const data = await internal.getPhoneNumbers(config.id)
      for (const item of data) {
        const bot = new WhatsAppBot(ctx, {})
        bot.selfId = item.id
        bot.adapter = this
        bot.internal = internal
        this.bots.push(bot)
        bot.online()
      }
    })
  }
}

export namespace WhatsAppAdapter {
  export interface Config extends Quester.Config {
    systemToken: string
    verifyToken: string
    id: string
    secret: string
  }

  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      secret: Schema.string().role('secret').description('App Secret').required(),
      systemToken: Schema.string().role('secret').description('System User Token').required(),
      verifyToken: Schema.string().role('secret').description('Verify Token').required(),
      id: Schema.string().description('WhatsApp Business Account ID').required(),
    }),
    Quester.createConfig('https://graph.facebook.com'),
  ] as const)
}
