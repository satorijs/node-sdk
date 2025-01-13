import { Context, Dict, Element, h, MessageEncoder } from '@satorijs/core'
import { TelegramBot } from './bot'
import * as Telegram from './utils'
import { exec, spawn } from 'child_process'
import { tmpdir } from 'os'
import { readFileSync } from 'fs'
import { readFile, rm, writeFile } from 'fs/promises'

type RenderMode = 'default' | 'figure'

const supportedElements = ['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'del', 'a']

export class TelegramMessageEncoder<C extends Context = Context> extends MessageEncoder<C, TelegramBot<C>> {
  private asset: h[] = []
  private payload: Dict
  private mode: RenderMode = 'default'
  private rows: Telegram.InlineKeyboardButton[][] = []

  async prepare() {
    const chat_id = this.session.guildId || this.channelId
    this.payload = { chat_id, parse_mode: 'html', caption: '' }
    if (this.session.guildId && this.channelId !== this.session.guildId) {
      this.payload.message_thread_id = +this.channelId
    }
  }

  async addResult(result: Telegram.Message) {
    const session = this.bot.session()
    await Telegram.decodeMessage(this.bot, result, session.event.message = {}, session.event)
    session.event._data ??= {}
    session.event._data.message = result
    this.results.push(session.event.message)
    session.app.emit(session, 'send', session)
  }

  async flush() {
    const send = async ({
      reuseFileId,
    }) => {
      const results = []
      const payload = JSON.parse(JSON.stringify(this.payload))
      let rows = this.rows

      this.trimButtons()

      if (this.asset.length > 0) {
        const files: {
          filename: string
          data: ArrayBuffer
          mime: string
          type: string
          element: Element
          fileid?: string
        }[] = []

        const typeMap = {
          img: 'photo',
          image: 'photo',
          audio: 'audio',
          video: 'video',
          file: 'document',
        }

        let i = 0
        for (const element of this.asset) {
          if (reuseFileId) {
            const url = element.attrs.src || element.attrs.url
            const hash = url.slice(url.lastIndexOf('#') + 1)
            const fileid = /^fileid="(.*?)"$/.exec(hash)?.[1] || /\/tg\-fileid\/(.*)/.exec(url)?.[1]
            if (fileid) {
              this.session.bot.logger.debug('trying to reuse fileid', fileid)
              files.push({
                filename: (i++).toString(),
                data: null,
                mime: 'application/octet-stream',
                type: typeMap[element.type] ?? element.type,
                fileid,
                element,
              })
              continue
            }
          }
          const { filename, data, mime } = await this.bot.ctx.http.file(element.attrs.src || element.attrs.url, element.attrs)
          files.push({
            filename: (i++) + filename,
            data,
            mime,
            type: filename.endsWith('gif') ? 'animation' : typeMap[element.type] ?? element.type,
            element,
          })
        }

        // Array of InputMediaAudio, InputMediaDocument, InputMediaPhoto and InputMediaVideo
        const inputFiles: Telegram.InputFile[] = []

        for (const { filename, type, element } of files) {
          const media = 'attach://' + filename
          inputFiles.push({
            media,
            type,
            has_spoiler: element.attrs.spoiler,
          })
        }

        if (files.length > 1) {
          inputFiles[0].caption = payload.caption
          inputFiles[0].parse_mode = payload.parse_mode

          const form = new FormData()

          const data = {
            chat_id: this.payload.chat_id,
            reply_to_message_id: this.payload.reply_to_message_id,
            message_thread_id: this.payload.message_thread_id,
            media: JSON.stringify(inputFiles),
          }
          for (const key in data) {
            form.append(key, data[key])
          }

          for (const { filename, data, mime } of files) {
            if (data) { form.append(filename, new Blob([data], { type: mime }), filename) }
          }

          // @ts-ignore
          const result = await this.bot.internal.sendMediaGroup(form)

          for (const x of result) { await this.addResult(x) }

          if (rows.length > 0 && rows[0].length > 0) {
            const result2 = await this.bot.internal.sendMessage({
              chat_id: payload.chat_id,
              text: payload.caption,
              parse_mode: payload.parse_mode,
              reply_to_message_id: result[0].message_id,
              message_thread_id: payload.message_thread_id,
              disable_web_page_preview: !this.options.linkPreview,
              reply_markup: {
                inline_keyboard: rows,
              },
            })

            results.push(result2)
            delete payload.reply_to_message_id
            payload.caption = ''
            rows = []
          }

          delete payload.reply_to_message_id
          payload.caption = ''
          rows = []
        } else {
          const sendMap = [
            ['audio', ['sendAudio', 'audio']],
            ['voice', ['sendAudio', 'audio']],
            ['video', ['sendVideo', 'video']],
            ['animation', ['sendAnimation', 'animation']],
            ['image', ['sendPhoto', 'photo']],
            ['photo', ['sendPhoto', 'photo']],
            ['document', ['sendDocument', 'document']],
            ['', ['sendDocument', 'document']],
          ] as const
          const [, [method, dataKey]] = sendMap.find(([key]) => files[0].type.startsWith(key)) || []

          const formData = new FormData()
          formData.append('chat_id', payload.chat_id)
          formData.append('caption', payload.caption)
          formData.append('parse_mode', payload.parse_mode)
          formData.append('reply_to_message_id', payload.reply_to_message_id)
          formData.append('message_thread_id', payload.message_thread_id)
          formData.append('has_spoiler', files[0].element.attrs.spoiler ? 'true' : 'false')
          formData.append(dataKey, files[0].fileid ? files[0].fileid : 'attach://' + files[0].filename)

          if (dataKey === 'video') {
            formData.append('supports_streaming', 'true')

            // use ffmpeg to extract video thumbnail
            const getThumbnail = async (data: ArrayBuffer) => {
              const tmpdi = tmpdir()
              const tmpin = `${tmpdi}/${Math.random().toString(36).substring(7)}.mp4`
              const tmpout = `${tmpdi}/${Math.random().toString(36).substring(7)}.jpg`

              await writeFile(tmpin, new Uint8Array(data))
              const rs = await new Promise<Buffer>((resolve, reject) => {
                const ffmpeg = spawn('ffmpeg', ['-i', tmpin, '-vf', 'thumbnail', '-frames:v', '1', tmpout])
                ffmpeg.on('close', async code => code === 0 ? resolve(
                  await readFile(tmpout)
                ) : reject(new Error(`ffmpeg exited with code ${code}`))
                )
              })

              await rm(tmpin)
              await rm(tmpout)
              return rs
            }

            if (files[0].data) {
              const thumbnail = await getThumbnail(files[0].data)

              formData.append('thumb', new Blob([thumbnail], { type: 'image/jpeg' }), 'thumbnail.jpg')
              // extract video duration/width/height with ffprobe
              const ffprobe = async (data: ArrayBuffer) => {
                const tmpdi = tmpdir()
                const tmpin = `${tmpdi}/${Math.random().toString(36).substring(7)}.mp4`

                await writeFile(tmpin, new Uint8Array(data))
                return new Promise<string>((resolve, reject) => {
                  exec(`ffprobe -v error -show_entries format=duration:stream=width:stream=height -of default=noprint_wrappers=1:nokey=1 ${tmpin}`, (err, stdout) => {
                    if (err) reject(err)
                    else resolve(stdout)
                  })
                })
              }

              const ffprobeResult = await ffprobe(files[0].data)
              const [width, height, duration] = ffprobeResult.split('\n').map(x => parseInt(x))

              formData.append('duration', duration.toString())
              formData.append('width', width.toString())
              formData.append('height', height.toString())
            }
          }

          if (files[0].data) { formData.append(files[0].filename, new Blob([files[0].data], { type: files[0].mime }), files[0].filename) }

          // @ts-ignore
          const result = await this.bot.internal[method](formData)
          results.push(result)
          payload.caption = ''
          rows = []
          delete payload.reply_to_message_id
        }
      } else {
        const result = await this.bot.internal.sendMessage({
          chat_id: payload.chat_id,
          text: payload.caption,
          parse_mode: payload.parse_mode,
          reply_to_message_id: payload.reply_to_message_id,
          message_thread_id: payload.message_thread_id,
          disable_web_page_preview: !this.options.linkPreview,
          reply_markup: {
            inline_keyboard: rows,
          },
        })
        results.push(result)
        delete payload.reply_to_message_id
        payload.caption = ''
        rows = []
      }

      delete this.payload.reply_to_message_id
      this.payload.caption = ''
      this.rows = []
      this.asset = []

      return results
    }

    if (this.payload.caption || this.asset.length > 0) {
      let res: unknown[]
      if (this.session.bot.config.files.reuseFileid) {
        try {
          res = await send({ reuseFileId: true })
        } catch (e) {
          if (e.message.includes('Telegram API error 400.')) {
            res = await send({ reuseFileId: false })
          } else {
            throw e
          }
        }
      } else {
        res = await send({ reuseFileId: false })
      }

      for (const result of res) {
        await this.addResult(result)
      }
    }
  }

  decodeButton(attrs: Dict, label: string): Telegram.InlineKeyboardButton {
    if (attrs.type === 'link') {
      return {
        text: label,
        url: attrs.href,
      }
    } else if (attrs.type === 'input') {
      return {
        text: label,
        switch_inline_query_current_chat: attrs.text,
      }
    } else {
      return {
        text: label,
        callback_data: attrs.id,
      }
    }
  }

  lastRow() {
    if (!this.rows.length) this.rows.push([])
    let last = this.rows[this.rows.length - 1]
    if (last.length >= 5) {
      this.rows.push([])
      last = this.rows[this.rows.length - 1]
    }
    return last
  }

  trimButtons() {
    if (this.rows.length && this.rows[this.rows.length - 1].length === 0) this.rows.pop()
  }

  async visit(element: h) {
    const { type, attrs, children } = element
    if (type === 'text') {
      this.payload.caption += h.escape(attrs.content)
    } else if (type === 'br') {
      this.payload.caption += '\n'
    } else if (type === 'p') {
      if (!this.payload.caption.endsWith('\n')) this.payload.caption += '\n'
      await this.render(children)
      if (!this.payload.caption.endsWith('\n')) this.payload.caption += '\n'
    } else if (supportedElements.includes(type)) {
      this.payload.caption += element.toString()
    } else if (type === 'spl') {
      this.payload.caption += '<tg-spoiler>'
      await this.render(children)
      this.payload.caption += '</tg-spoiler>'
    } else if (type === 'code') {
      const { lang } = attrs
      this.payload.caption += `<code${lang ? ` class="language-${lang}"` : ''}>${h.escape(attrs.content)}</code>`
    } else if (type === 'at') {
      if (attrs.id) {
        this.payload.caption += `<a href="tg://user?id=${attrs.id}">@${attrs.name || attrs.id}</a>`
      }
    } else if (['img', 'image', 'audio', 'video', 'file'].includes(type)) {
      this.asset.push(element)
    } else if (type === 'figure') {
      await this.flush()
      this.mode = 'figure'
      await this.render(children)
      await this.flush()
      this.mode = 'default'
    } else if (type === 'quote') {
      await this.flush()
      this.payload.reply_to_message_id = attrs.id
    } else if (type === 'button') {
      const last = this.lastRow()
      last.push(this.decodeButton(
        attrs, children.join(''),
      ))
    } else if (type === 'button-group') {
      this.rows.push([])
      await this.render(children)
      this.rows.push([])
    } else if (type === 'message') {
      if (this.mode === 'figure') {
        await this.render(children)
        this.payload.caption += '\n'
      } else {
        await this.flush()
        await this.render(children)
        await this.flush()
      }
    } else {
      await this.render(children)
    }
  }
}
