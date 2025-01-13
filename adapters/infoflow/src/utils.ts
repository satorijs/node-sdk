import CryptoJS from 'crypto-js'
import { Context, h } from '@satorijs/core'
import InfoflowBot from './bot'
import { MessageRequest, r, ReceiveMessage } from './type'
export class AESCipher {
  key: CryptoJS.lib.WordArray
  options: any
  constructor(key: string) {
    this.key = CryptoJS.enc.Base64.parse(key)
    this.options = {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    }
  }

  // 加密
  encrypt(data) {
    const cipher = CryptoJS.AES.encrypt(data, this.key, this.options)
    const base64Cipher = cipher.ciphertext.toString(CryptoJS.enc.Base64)
    const resultCipher = base64Cipher
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
    return resultCipher
  }

  // 解密
  decrypt(content): MessageRequest {
    content = content
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(content.length + content.length % 4, '=')
    const bytes = CryptoJS.AES.decrypt(content, this.key, this.options)
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8))
  }
}

export function getParam(url: string): any {
  const search = url.split('?')[1]
  if (!search) return {}
  return search.split('&').reduce((pre, curr) => {
    const [key, val] = curr.split('=')
    return { ...pre, [key]: decodeURIComponent(val) }
  }, {})
}

export function getSignature(rn: string, timestamp: string, token: string) {
  return CryptoJS
    .MD5(`${rn}${timestamp}${token}`)
    .toString()
}

export function getSession<c extends Context>(bot: InfoflowBot<c>, message: ReceiveMessage) {
  const session = bot.session()
  const { body, header } = message
  session.setInternal('infoflow', body)
  session.type = 'message'
  session.elements = body.map(m2h)
  session.channelId = header.toid.toString()
  session.userId = header.fromuserid
  session.messageId = header.clientmsgid.toString()
  session.timestamp = header.servertime
  session.guildId = header.toid.toString()
  return session
}

function m2h(item: r): h | null {
  switch (item.type) {
    case 'AT':
      if (item.robotid) return null
      return h.at(item.userid, { name: item.name })
    case 'IMAGE':
      return h.image(item.downloadurl)
    case 'LINK':
      return h.text(item.label)
    case 'command':
      return h.text(item.commandname)
    case 'TEXT':
      return h.text(item.content)
  }
}

export function getBase64(data) {
  return btoa(new Uint8Array(data).reduce((data, byte) => data + String.fromCharCode(byte), ''))
}
