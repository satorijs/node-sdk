import * as QQ from './types'
import { Dict, h, MessageEncoder } from '@satorijs/satori'
import { QQBot } from './bot'
import FormData from 'form-data'
import { escape } from '@satorijs/element'
import { QQGuildBot } from './bot/guild'

export const escapeMarkdown = (val: string) =>
  val
    .replace(/([\\`*_[\*_~`\]\-(#!>])/g, '\\$&')

export class QQGuildMessageEncoder extends MessageEncoder<QQGuildBot> {
  private content: string = ''
  private file: Buffer
  private filename: string
  fileUrl: string
  reference: string
  private retry = false
  private resource: Dict
  // 先文后图
  async flush() {
    if (!this.content.trim().length && !this.file && !this.fileUrl) {
      return
    }
    const isDirect = this.channelId.includes('_')

    let endpoint = `/channels/${this.channelId}/messages`
    if (isDirect) endpoint = `/dms/${this.channelId.split('_')[0]}/messages`
    const useFormData = Boolean(this.file)
    let r: QQ.Message
    this.bot.ctx.logger('qq').debug('use form data %s', useFormData)
    try {
      if (useFormData) {
        const form = new FormData()
        form.append('content', this.content)
        if (this.options?.session) {
          form.append('msg_id', this.options?.session?.messageId)
        }
        if (this.file) {
          form.append('file_image', this.file, this.filename)
        }
        // if (this.fileUrl) {
        //   form.append('image', this.fileUrl)
        // }
        r = await this.bot.http.post<QQ.Message>(endpoint, form, {
          headers: form.getHeaders(),
        })
      } else {
        r = await this.bot.http.post<QQ.Message>(endpoint, {
          ...{
            content: this.content,
            msg_id: this.options?.session?.messageId ?? this.options?.session?.id,
            image: this.fileUrl,
          },
          ...(this.reference ? {
            messageReference: {
              message_id: this.reference,
            },
          } : {}),
        })
      }
    } catch (e) {
      this.bot.ctx.logger('qq').error(e)
      this.bot.ctx.logger('qq').error('[response] %o', e.response?.data)
      if ((e.repsonse?.data?.code === 40004 || e.response?.data?.code === 102) && !this.retry && this.fileUrl) {
        this.bot.ctx.logger('qq').warn('retry image sending')
        this.retry = true
        await this.resolveFile(null, true)
        await this.flush()
      }
    }

    this.bot.ctx.logger('qq').debug(r)
    const session = this.bot.session()
    session.type = 'send'
    // await decodeMessage(this.bot, r, session.event.message = {}, session.event)
    if (isDirect) {
      session.guildId = this.session.guildId
      session.channelId = this.channelId
      session.isDirect = true
    }

    // https://bot.q.qq.com/wiki/develop/api/gateway/direct_message.html#%E6%B3%A8%E6%84%8F
    // this.results.push(session.event.message)
    // session.app.emit(session, 'send', session)
    this.content = ''
    this.file = null
    this.filename = null
    this.fileUrl = null
    this.resource = null
    this.retry = false
  }

  async resolveFile(attrs: Dict, download = false) {
    if (attrs) this.resource = attrs
    if (this.resource.url.startsWith('http') && !download) {
      return this.fileUrl = this.resource.url
    }
    const { data, filename } = await this.bot.ctx.http.file(this.resource.url, this.resource)
    this.file = Buffer.from(data)
    this.filename = filename
    this.fileUrl = null
  }

  async visit(element: h) {
    const { type, attrs, children } = element
    if (type === 'text') {
      this.content += escape(attrs.content)
    } else if (type === 'at') {
      switch (attrs.type) {
        case 'all':
          this.content += `@everyone`
          break
        default:
          this.content += `<@${attrs.id}>`
      }
    } else if (type === 'br') {
      this.content += '\n'
    } else if (type === 'p') {
      if (!this.content.endsWith('\n')) this.content += '\n'
      await this.render(children)
      if (!this.content.endsWith('\n')) this.content += '\n'
    } else if (type === 'sharp') {
      this.content += `<#${attrs.id}>`
    } else if (type === 'quote') {
      this.reference = attrs.id
      await this.flush()
    } else if (type === 'image' && attrs.url) {
      await this.flush()
      await this.resolveFile(attrs)
      await this.flush()
    } else if (type === 'message') {
      await this.flush()
      await this.render(children)
      await this.flush()
    } else {
      await this.render(children)
    }
  }
}

export class QQMessageEncoder extends MessageEncoder<QQBot> {
  private content: string = ''
  private useMarkdown = false
  private rows: QQ.InlineKeyboardRow[] = []
  private buttonGroupState = false
  async flush() {
    if (!this.content.trim() && !this.rows.map(v => v.buttons).flat().length) return
    const data: QQ.SendMessageParams = {
      content: this.content,
      msg_type: 0,
      timestamp: Math.floor(Date.now() / 1000),
      msg_id: this.options?.session?.messageId,
    }

    if (this.useMarkdown) {
      data.msg_type = 2
      delete data.content
      data.markdown = {
        content: escapeMarkdown(this.content) || ' ',
      }
      if (this.rows.length) {
        data.keyboard = {
          content: {
            rows: this.rows,
          },
        }
      }
    }
    const session = this.bot.session()
    session.type = 'send'
    try {
      if (this.session.isDirect) {
        const { sendResult: { msg_id } } = await this.bot.internal.sendPrivateMessage(this.session.channelId, data)
        session.messageId = msg_id
      } else {
        // FIXME: missing message id
        await this.bot.internal.sendMessage(this.guildId, data)
      }
    } catch (e) {
      this.bot.ctx.logger('qq').error(e)
      this.bot.ctx.logger('qq').error('[response] %o', e.response?.data)
    }

    // this.results.push(session.event.message)
    // session.app.emit(session, 'send', session)
    this.content = ''
    this.rows = []
  }

  async sendFile(type: string, attrs: Dict) {
    if (!attrs.url.startsWith('http')) {
      return this.bot.ctx.logger('qq').warn('unsupported file url')
    }
    await this.flush()
    let file_type = 0
    if (type === 'image') file_type = 1
    else if (type === 'video') file_type = 2
    else return
    const data: QQ.SendFileParams = {
      file_type,
      url: attrs.url,
      srv_send_msg: true,
    }
    if (this.session.isDirect) {
      await this.bot.internal.sendFilePrivate(this.options.session.event.message.user.id, data)
    } else {
      await this.bot.internal.sendFileGuild(this.session.guildId, data)
    }
  }

  decodeButton(attrs: Dict, label: string) {
    const result: QQ.Button = {
      id: attrs.id,
      render_data: {
        label,
        visited_label: label,
        style: 0,
      },
      action: {
        type: attrs.type === 'input' ? 2
          : (attrs.type === 'link' ? 0 : 1),
        permission: {
          type: 2,
        },
        data: attrs.data,
      },
    }
    return result
  }

  async visit(element: h) {
    const { type, attrs, children } = element
    if (type === 'text') {
      this.content += escape(attrs.content)
    } else if (type === 'image' && attrs.url) {
      await this.sendFile(type, attrs)
    } else if (type === 'video' && attrs.url) {
      await this.sendFile(type, attrs)
    } else if (type === 'button-group') {
      this.useMarkdown = true
      this.buttonGroupState = true
      this.rows.push({ buttons: [] })
      await this.render(children)
      this.buttonGroupState = false
    } else if (type === 'button') {
      this.useMarkdown = true
      if (this.buttonGroupState) {
        const last = this.rows[this.rows.length - 1]
        last.buttons.push(this.decodeButton(attrs, children.join('')))
      } else {
        this.rows.push({
          buttons: [
            this.decodeButton(attrs, children.join('')),
          ],
        })
      }
    } else if (type === 'message') {
      await this.flush()
      await this.render(children)
      await this.flush()
    } else {
      await this.render(children)
    }
  }
}
