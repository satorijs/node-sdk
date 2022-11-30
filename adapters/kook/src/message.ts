import { Messenger, Schema, segment } from '@satorijs/satori'
import FormData from 'form-data'
import { KookBot } from './bot'
import { adaptMessage } from './utils'
import * as Kook from './types'
import internal from 'stream'

const attachmentTypes = ['image', 'video', 'audio', 'file']

export class KookMessenger extends Messenger<KookBot> {
  private path: string
  private params = {} as Partial<Kook.MessageParams>
  private additional = {} as Partial<Kook.MessageParams>
  private buffer: string = ''

  constructor(bot: KookBot, channelId: string, guildId?: string) {
    super(bot, channelId, guildId)
    if (channelId.length > 30) {
      this.params.chat_code = channelId
      this.path = '/user-chat/create-msg'
    } else {
      this.params.target_id = channelId
      this.path = '/message/create'
    }
  }

  async post(type: Kook.Type, content: string) {
    try {
      const params = { ...this.params, ...this.additional, type, content }
      const result = await this.bot.request('POST', this.path, params)
      const session = this.bot.session()
      adaptMessage(result, session)
      this.results.push(session)
      session.app.emit(session, 'send', session)
    } catch (e) {
      this.errors.push(e)
    }
  }

  private async transformUrl({ type, attrs }: segment) {
    if (['file:', 'base64:', 'data:'].some(protocol => attrs.url.startsWith(protocol))) {
      const payload = new FormData()
      const result = await this.bot.ctx.http.file(attrs.url)
      payload.append('file', Buffer.from(result.data), {
        filename: attrs.file || result.filename,
      })
      const { url } = await this.bot.request('POST', '/asset/create', payload, payload.getHeaders())
      return url
    } else if (!attrs.url.includes('kaiheila')) {
      const res = await this.bot.ctx.http.get<internal.Readable>(attrs.url, {
        headers: { accept: type + '/*' },
        responseType: 'stream',
      })
      const payload = new FormData()
      payload.append('file', res, {
        filename: 'file',
      })
      const { url } = await this.bot.request('POST', '/asset/create', payload, payload.getHeaders())
      return url
    }
  }

  private async _sendCard(chain: segment[], useMarkdown: boolean) {
    const type = useMarkdown ? 'kmarkdown' : 'plain-text'
    let text: Kook.Card.Text = { type, content: '' }
    let card: Kook.Card = { type: 'card', modules: [] }
    const output: Kook.Card[] = []
    const flushText = () => {
      text.content = text.content.trim()
      if (!text.content) return
      card.modules.push({ type: 'section', text })
      text = { type, content: '' }
    }
    const flushCard = () => {
      flushText()
      if (!card.modules.length) return
      output.push(card)
      card = { type: 'card', modules: [] }
    }

    for (const element of chain) {
      const { type, attrs } = element
      if (type === 'text') {
        text.content += attrs.content
      } else if (type === 'at') {
        if (attrs.id) {
          text.content += `@user#${attrs.id}`
        } else if (attrs.type === 'all') {
          text.content += '@全体成员'
        } else if (attrs.type === 'here') {
          text.content += '@在线成员'
        } else if (attrs.role) {
          text.content += `@role:${attrs.role};`
        }
      } else if (type === 'sharp') {
        text.content += `#channel:${attrs.id};`
      } else if (attachmentTypes.includes(type)) {
        flushText()
        await this.transformUrl(element)
        if (type === 'image') {
          card.modules.push({
            type: 'image-group',
            elements: [{
              type: 'image',
              src: attrs.url,
            }],
          })
        } else {
          card.modules.push({
            type: type as never,
            src: attrs.url,
          })
        }
      } else if (type === 'card') {
        flushCard()
        output.push(JSON.parse(attrs.content))
      }
    }
    flushCard()
    await this.post(Kook.Type.card, JSON.stringify(output))
  }

  async flush() {
    const content = this.buffer.trim()
    if (!content) return
    await this.post(Kook.Type.kmarkdown, content)
    this.buffer = ''
    this.additional = {}
  }

  async visit(element: segment) {
    const { type, attrs, children } = element
    if (type === 'text') {
      this.buffer += attrs.content.replace(/[\\*_`~()]/g, '\\$&')
    } else if (type === 'b' || type === 'strong') {
      this.buffer += '**'
      await this.render(children)
      this.buffer += '**'
    } else if (type === 'i' || type === 'em') {
      this.buffer += '*'
      await this.render(children)
      this.buffer += '*'
    } else if (type === 'u' || type === 'ins') {
      this.buffer += '(ins)'
      await this.render(children)
      this.buffer += '(ins)'
    } else if (type === 's' || type === 'del') {
      this.buffer += '~~'
      await this.render(children)
      this.buffer += '~~'
    } else if (type === 'spl') {
      this.buffer += '(spl)'
      await this.render(children)
      this.buffer += '(spl)'
    } else if (type === 'code') {
      this.buffer += '`'
      await this.render(children)
      this.buffer += '`'
    } else if (type === 'a') {
      this.buffer += `[`
      await this.render(children)
      this.buffer += `](${attrs.href})`
    } else if (type === 'p') {
      await this.render(children)
      this.buffer += '\n'
    } else if (type === 'at') {
      if (attrs.id) {
        this.buffer += `(met)${attrs.id}(met)`
      } else if (attrs.type === 'all') {
        this.buffer += `(met)all(met)`
      } else if (attrs.type === 'here') {
        this.buffer += `(met)here(met)`
      } else if (attrs.role) {
        this.buffer += `(rol)${attrs.role}(rol)`
      }
    } else if (type === 'code') {
      this.buffer += `\`${element.toString(true)}\``
    } else if (type === 'sharp') {
      this.buffer += `(chn)${attrs.id}(chn)`
    } else if (['image', 'video', 'audio', 'file'].includes(type)) {
      await this.flush()
      const url = await this.transformUrl(element)
      await this.post(Kook.Type[type], url)
    } else if (type === 'quote') {
      await this.flush()
      this.additional.quote = attrs.id
    } else if (type === 'message') {
      await this.flush()
      await this.render(children)
      await this.flush()
    } else {
      await this.render(children)
    }
  }
}

export namespace KookMessenger {
  export type HandleMixedContent = 'card' | 'separate' | 'mixed'

  export interface Config {
    handleMixedContent?: HandleMixedContent
  }

  export const Config: Schema<KookMessenger.Config> = Schema.object({
    handleMixedContent: Schema.union([
      Schema.const('separate' as const).description('将每个不同形式的内容分开发送'),
      Schema.const('card' as const).description('使用卡片发送内容'),
      Schema.const('mixed' as const).description('使用混合模式发送内容'),
    ]).role('radio').description('发送图文等混合内容时采用的方式。').default('separate'),
  }).description('发送设置')
}
