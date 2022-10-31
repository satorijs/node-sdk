import { Modulator, segment } from '@satorijs/core'
import { FeishuBot } from './bot'

export class FeishuModulator extends Modulator<FeishuBot> {
  private mode: 'default' | 'figure' = 'default'
  private content = ''
  private addition = {
    file: null as {
      id: string
      type: FeishuBot.Message.FileContents['msg_type']
    } | null,
  }

  async post(data?: any, headers?: any) {
    try {
      const result = await this.bot.http.post(`/channels/${this.channelId}/messages`, data, { headers })
      const session = this.bot.session()
      // await adaptMessage(this.bot, result, session)
      session.app.emit(session, 'send', session)
      this.results.push(session)
    } catch (e) {
      this.errors.push(e)
    }
  }

  async flush() {
    if (
      this.content === ''
      && this.addition.file === null
    )
      return
    let message = {} as FeishuBot.Message.Contents<FeishuBot.Message.Content['msg_type']>
    if (this.addition.file) {
      message.msg_type = this.addition.file.type
      if (FeishuBot.Message.isWhatContents('image', message)) {
        message.image_key = this.addition.file.id
      } else if (
        FeishuBot.Message.isWhatContents('audio', message)
        || FeishuBot.Message.isWhatContents('file', message)
      ) {
        message.file_key = this.addition.file.id
      } else if (FeishuBot.Message.isWhatContents('media', message)) {
        message.file_key = this.addition.file.id
      }
    } else {
      message.msg_type = 'text'
      if (FeishuBot.Message.isWhatContents('text', message)) {
        message.text = this.content
      }
    }
    await this.post({
      content: JSON.stringify(message)
    })
  }

  async sendFile(type: 'image' | 'video' | 'audio' |'file', url: string) {
    let newType = type as FeishuBot.Message.FileContents['msg_type']
    if (type === 'audio') {
      newType = 'media'
    }
    // TODO send file, and get file id
    return {
      id: 'fileId',
      type: newType,
    }
  }

  async visit(element: segment) {
    const { type, attrs, children } = element
    if (type === 'text') {
      this.content += attrs.content
    } else if (type === 'at') {
      switch (attrs.type) {
        case 'all':
          this.content += `<at user_id="all">${ attrs.name ?? '所有人' }</at>`
          break
        default:
          this.content += `<at user_id="${attrs.id}">${attrs.name}</at>`
      }
    } else if (type === 'sharp') {
      // platform does not support sharp
    } else if (type === 'quote') {
      await this.flush()
      // platform does not support quote
    } else if ((type === 'image' || type === 'video' || type === 'audio' || type === 'file') && attrs.url) {
      await this.flush()
      this.addition.file = await this.sendFile(type, attrs.url)
    } else if (type === 'figure') {
      await this.flush()
      this.mode = 'figure'
      await this.render(children, true)
      this.mode = 'default'
    } else if (type === 'message') {
      if (this.mode === 'figure') {
        await this.render(children)
        this.content += '\n'
      } else {
        await this.flush()
        await this.render(children, true)
      }
    } else {
      await this.render(children)
    }
  }
}
