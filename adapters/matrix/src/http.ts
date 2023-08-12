import { Adapter, Context, Logger } from '@satorijs/satori'
import { Context as KoaContext } from 'koa'
import { MatrixBot } from './bot'
import { dispatchSession } from './utils'
import { ClientEvent, M_ROOM_MEMBER } from './types'

const logger = new Logger('matrix')

export class HttpAdapter extends Adapter.Server<MatrixBot> {
  private txnId: string = null

  public constructor(ctx: Context) {
    super()
    ctx.router.all('/(.*)', (koaCtx, next) => {
      const match = this.bots.filter(bot => koaCtx.path.startsWith(bot.config.path + '/'))
      if (match.length === 0) return next()
      const bots = match.filter(bot => bot.config.hsToken === koaCtx.query.access_token)
      if (!bots.length) {
        koaCtx.status = 403
        koaCtx.body = { errcode: 'M_FORBIDDEN' }
        return
      }
      const trimmed = koaCtx.path.substring(bots[0].config.path.length)
      const path = trimmed.startsWith('/_matrix/app/v1/') ? trimmed.substring(15) : trimmed
      if (koaCtx.method === 'PUT' && path.startsWith('/transactions/')) {
        const txnId = path.substring(14)
        this.transactions(koaCtx, bots, txnId)
      } else if (koaCtx.method === 'GET' && path.startsWith('/users/')) {
        const user = path.substring(7)
        this.users(koaCtx, bots, user)
      } else if (koaCtx.method === 'GET' && path.startsWith('/rooms/')) {
        const room = path.substring(7)
        this.rooms(koaCtx, bots, room)
      } else {
        koaCtx.status = 404
      }
    })
  }

  async start(bot: MatrixBot): Promise<void> {
    try {
      await bot.initialize()
      bot.online()
    } catch (e) {
      logger.error('failed to initialize', e)
      throw e
    }
  }

  private transactions(ctx: KoaContext, bots: MatrixBot[], txnId: string) {
    const events = ctx.request.body.events as ClientEvent[]
    ctx.body = {}
    if (txnId === this.txnId) return
    this.txnId = txnId
    for (const event of events) {
      const inRoom = bots.filter(bot => bot.userId !== event.sender && bot.rooms.includes(event.room_id))
      let bot: MatrixBot
      if (event.type === 'm.room.member'
        && (event.content as M_ROOM_MEMBER).membership === 'invite'
        && (bot = bots.find(bot => bot.userId === event.state_key))
        && !inRoom.includes(bot)) {
        inRoom.push(bot)
      }
      inRoom.forEach(bot => dispatchSession(bot, event))
    }
  }

  private users(ctx: KoaContext, bots: MatrixBot[], userId: string) {
    if (!bots.find(bot => bot.userId === userId)) {
      ctx.status = 404
      ctx.body = { 'errcode': 'CHAT.SATORI.NOT_FOUND' }
      return
    }
    ctx.body = {}
  }

  private rooms(ctx: KoaContext, bots: MatrixBot[], room: string) {
    ctx.status = 404
    ctx.body = { 'errcode': 'CHAT.SATORI.NOT_FOUND' }
  }
}
