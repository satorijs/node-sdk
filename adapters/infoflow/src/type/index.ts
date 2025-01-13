export * from './internal'
export * from './api'

export interface requestUrlParam{
  signature?: string
  rn?: string
  timestamp?: string
  echostr?: string
}

export interface MessageRequest {
  eventtype: string
  agentid: number
  groupid: number
  corpid: string
  time: number
  fromid: number
  opencode: string
  message: ReceiveMessage
}

export type Text = {
  type: 'TEXT'
  content: string
}

export type Link = {
  type: 'LINK'
  href: string
  label?: string
}

export type rAt = {
  type: 'AT'
  name: string
  robotid?: number
  userid?: string
}

export type sAt = {
  type: 'AT'
  atuserids?: string[]
  robotid?: number
  atall?: boolean
}

export type rImage = {
  type: 'IMAGE'
  downloadurl: string
}

export type sImage = {
  type: 'IMAGE'
  content: string
}

export type Md = {
  type: 'MD'
  content: string
}

export type Command = {
  type: 'command'
  commandname: string
}

export type r = Text | Link | rImage | Md | Command | rAt

export type s = Text | Link | sImage | Md | Command | sAt

export interface ReceiveMessage{
  header: {
    fromuserid: string
    toid: number
    totype: string
    msgtype: string
    clientmsgid: number
    messageid: number
    msgseqid: string
    at: object
    compatible: string
    offlinenotify: string
    extra: string
    servertime: number
    clientime: number
    updatetime: number
  }
  body: r[]
}

export interface SendMessage {
  message: {
    header: {
      toid: number | number[]
    }
    body: s[]
  }
}
