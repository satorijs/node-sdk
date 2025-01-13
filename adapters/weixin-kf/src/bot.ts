import { Bot, Context, Quester, Schema } from '@satorijs/satori'
import { HttpServer } from './http'
import { WechatOfficialMessageEncoder } from './message'
// import { Internal } from './types/internal'

export class WechatKfBot<C extends Context = Context> extends Bot<C, WechatOfficialBot.Config> {
  static inject = ['server', 'http']
  static MessageEncoder = WechatOfficialMessageEncoder

  http: Quester
  // internal: Internal
  refreshTokenTimer: NodeJS.Timeout

  constructor(ctx: C, config: WechatOfficialBot.Config) {
    super(ctx, config, 'wechat-official')
    this.selfId = config.account
    this.http = ctx.http.extend(config)
    // this.internal = new Internal(this.http, this)
    ctx.plugin(HttpServer, this)
  }

  // @ts-ignore
  stop(): Promise<void> {
    clearTimeout(this.refreshTokenTimer)
  }

  public token: string
  /** https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Get_access_token.html */
  async refreshToken() {
    const { access_token, expires_in, errcode, errmsg } = await this.http.get<{
      access_token: string
      expires_in: number
      errcode?: number
      errmsg?: string
    }>('/cgi-bin/token', {
      params: {
        grant_type: 'client_credential',
        appid: this.config.appid,
        secret: this.config.secret,
      },
    })
    if (errcode > 0) {
      this.logger.error(errmsg)
      return
    }
    this.token = access_token
    this.logger.debug('token %o, expires in %d', access_token, expires_in)
    this.refreshTokenTimer = setTimeout(this.refreshToken.bind(this), (expires_in - 10) * 1000)
    return access_token
  }

  /** https://developers.weixin.qq.com/doc/offiaccount/Customer_Service/Customer_Service_Management.html */
  async ensureCustom() {
    if (!this.config.customerService) return
    const data = await this.http.get<{
      kf_list: {
        kf_account: string
        kf_headimgurl: string
        kf_id: number
        kf_nick: string
      }[]
    }>('/cgi-bin/customservice/getkflist', {
      params: { access_token: this.token },
    })
    if (data.kf_list.find(v => v.kf_nick === 'Koishi')) return
    await this.http.post('/customservice/kfaccount/add', {
      kf_account: 'koishi@' + this.config.account,
      nickname: 'Koishi',
    }, {
      params: { access_token: this.token },
    })
  }

  async getMedia(mediaId: string) {
    return await this.http.get('/cgi-bin/media/get', {
      params: {
        access_token: this.token,
        media_id: mediaId,
      },
    })
  }

  $toMediaUrl(mediaId: string) {
    return `${this.ctx.server.config.selfUrl}/wechat-official/assets/${this.selfId}/${mediaId}`
  }
}

export namespace WechatOfficialBot {
  export interface Config extends Quester.Config {
    appid: string
    secret: string
    token: string
    aesKey: string
    customerService: boolean
    account: string
  }

  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      account: Schema.string().required(),
      appid: Schema.string().description('AppID').required(),
      secret: Schema.string().role('secret').description('AppSecret').required(),
      token: Schema.string().role('secret').description('Webhook Token').required(),
      aesKey: Schema.string().role('secret').description('EncodingAESKey'),
      customerService: Schema.boolean().default(false).description('启用客服消息回复'),
    }),
    Quester.createConfig('https://api.weixin.qq.com/'),
  ])
}
