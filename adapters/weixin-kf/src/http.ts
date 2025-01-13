import { Adapter, Context } from '@satorijs/satori'
import {} from '@cordisjs/server'
import { WechatOfficialBot } from './bot'
import xml2js from 'xml2js'
import { Message } from './types'
import { decodeMessage } from './utils'
import { decrypt, encrypt, getSignature } from '@wecom/crypto'

export class HttpServer<C extends Context = Context> extends Adapter<C, WechatOfficialBot<C>> {
  static inject = ['server']

  async connect(bot: WechatOfficialBot) {
    await bot.refreshToken()
    await bot.ensureCustom()

    // https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Access_Overview.html
    bot.ctx.server.get('/wechat-official', async (ctx) => {
      let success = false
      const { signature, timestamp, nonce, echostr } = ctx.request.query

      for (const bot of this.bots) {
        const localSign = getSignature(bot.config.token, timestamp?.toString(), nonce?.toString(), '')
        if (localSign === signature) {
          success = true
          break
        }
      }
      if (!success) return ctx.status = 403
      ctx.status = 200
      ctx.body = echostr
    })

    bot.ctx.server.post('/wechat-official', async (ctx) => {
      const { timestamp, nonce, msg_signature } = ctx.request.query
      let { xml: data }: {
        xml: Message
      } = await xml2js.parseStringPromise(ctx.request.rawBody, {
        explicitArray: false,
      })
      const botId = data.ToUserName
      const localBot = this.bots.find((bot) => bot.selfId === botId)

      if (data.Encrypt) {
        const localSign = getSignature(localBot.config.token, timestamp?.toString(), nonce?.toString(), data.Encrypt)
        if (localSign !== msg_signature) return ctx.status = 403
        const { message, id } = decrypt(bot.config.aesKey, data.Encrypt)
        if (id !== localBot.config.appid) return ctx.status = 403
        const { xml: data2 } = await xml2js.parseStringPromise(message, {
          explicitArray: false,
        })
        bot.logger.debug('decrypted %c', data2)
        data = data2
      }

      bot.logger.debug('%c', ctx.request.rawBody)

      const session = await decodeMessage(localBot, data)

      let resolveFunction: (text: string) => void
      const promise = new Promise((resolve, reject) => {
        if (localBot.config.customerService) return resolve('success')
        const timeout = setTimeout(() => {
          ctx.status = 200
          ctx.body = 'success'
          reject(new Error('timeout'))
        }, 4500)
        resolveFunction = (text: string) => {
          resolve(text)
          clearTimeout(timeout)
        }
      })
      if (session) {
        session.wechatOfficialResolve = resolveFunction
        localBot.dispatch(session)
        // localBot.logger.debug(session)
      }
      try {
        const result: any = await promise
        if (localBot.config.aesKey) {
          const builder = new xml2js.Builder({
            cdata: true,
            headless: true,
          })
          const encrypted = encrypt(localBot.config.aesKey, result, localBot.config.appid)
          const sign = getSignature(localBot.config.token, timestamp?.toString(), nonce?.toString(), encrypted)
          const xml = builder.buildObject({
            xml: {
              Encrypt: encrypted,
              Nonce: nonce,
              TimeStamp: timestamp,
              MsgSignature: sign,
            },
          })
          return ctx.body = xml
        }

        ctx.status = 200
        ctx.body = result
      } catch (error) {
        localBot.logger.warn('resolve timeout')
        ctx.status = 200
        ctx.body = 'success'
      }
    })

    bot.ctx.server.get('/wechat-official/assets/:self_id/:media_id', async (ctx) => {
      const mediaId = ctx.params.media_id
      const selfId = ctx.params.self_id
      const localBot = this.bots.find((bot) => bot.selfId === selfId)
      if (!localBot) return ctx.status = 404
      const resp = await localBot.http<ReadableStream>(`/cgi-bin/media/get`, {
        method: 'GET',
        responseType: 'stream',
        params: {
          access_token: localBot.token,
          media_id: mediaId,
        },
      })
      ctx.type = resp.headers.get('content-type')
      ctx.set('date', resp.headers.get('date'))
      ctx.set('cache-control', resp.headers.get('cache-control'))
      ctx.response.body = resp.data
      ctx.status = 200
    })

    bot.online()
  }
}
