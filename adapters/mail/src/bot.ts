import { Bot, Fragment, Logger, Schema, SendOptions } from '@satorijs/satori'
import { ParsedMail } from 'mailparser'
import { IMAP, SMTP } from './mail'
import { MailMessenger } from './message'
import { dispatchSession } from './utils'

const logger = new Logger('adapter-mail')

export class MailBot extends Bot<MailBot.Config> {
  imap: IMAP
  smtp: SMTP

  async start() {
    this.username = this.config.username
    await super.start()
    this.imap = new IMAP(
      this.config,
      this.online.bind(this),
      this.onClose.bind(this),
      this.onMail.bind(this),
      this.onError.bind(this),
    )
    this.smtp = new SMTP(this.config)
  }

  async stop() {
    await super.stop()
    this.imap.stop()
  }

  onError(error: Error) {
    logger.error(error)
  }

  onMail(mail: ParsedMail) {
    dispatchSession(this, mail)
  }

  onClose() {
    if (this.status === 'disconnect') {
      this.offline()
      return
    }
    logger.info('IMAP disconnected, will reconnect in 3s...')
    this.status = 'reconnect'
    setTimeout(() => {
      if (this.status !== 'reconnect') {
        this.offline()
        return
      }
      this.imap.connect()
    }, 3000)
  }

  async sendMessage(channelId: string, content: Fragment, guildId?: string, options?: SendOptions) {
    return await new MailMessenger(this, channelId, guildId, options).send(content)
  }

  async sendPrivateMessage(userId: string, content: Fragment, options?: SendOptions) {
    return await this.sendMessage(`private:${userId}`, content, null, options)
  }
}

export namespace MailBot {
  export interface Config extends Bot.Config {
    name: string
    username: string
    password: string
    subject: string
    imap: {
      host: string
      port: number
      tls: boolean
    }
    smtp: {
      host: string
      port: number
      tls: boolean
    }
  }

  export const Config = Schema.object({
    username: Schema.string().description('用户名。').required(),
    password: Schema.string().description('密码。').required(),
    selfId: Schema.string().description('邮件地址 (默认与用户名相同)。'),
    name: Schema.string().description('发送邮件时显示的名称。'),
    subject: Schema.string().description('机器人发送的邮件主题。').default('Koishi'),
    imap: Schema.intersect([
      Schema.object({
        host: Schema.string().description('IMAP 服务器地址。').required(),
        tls: Schema.boolean().description('是否开启 TLS 加密。').default(true),
      }).description('IMAP 设置'),
      Schema.union([
        Schema.object({
          tls: Schema.const(true),
          port: Schema.number().description('IMAP 服务器端口。').default(993),
        }),
        Schema.object({
          tls: Schema.const(false),
          port: Schema.number().description('IMAP 服务器端口。').default(143),
        }),
      ]),
    ]),
    smtp: Schema.intersect([
      Schema.object({
        host: Schema.string().description('SMTP 服务器地址。').required(),
        tls: Schema.boolean().description('是否开启 TLS 加密。').default(true),
      }).description('SMTP 设置'),
      Schema.union([
        Schema.object({
          tls: Schema.const(true),
          port: Schema.number().description('SMTP 服务器端口。').default(465),
        }),
        Schema.object({
          tls: Schema.const(false),
          port: Schema.number().description('SMTP 服务器端口。').default(25),
        }),
      ]),
    ]),
  })
}

MailBot.prototype.platform = 'mail'
