export interface BaseMessage {
  ToUserName: string
  FromUserName: string
  CreateTime: number
  MsgId: string
  MsgDataId: string
  Idx?: string
  Encrypt?: string
}

export type Message = TextMessage | ImageMessage | VoiceMessage | VideoMessage | LocationMessage | EventMessage

export interface TextMessage extends BaseMessage {
  MsgType: 'text'
  Content: string
}

export interface ImageMessage extends BaseMessage {
  MsgType: 'image'
  PicUrl: string
  MediaId: string
}

export interface VoiceMessage extends BaseMessage {
  MsgType: 'voice'
  MediaId: string
  Format: string
  Recogonition?: string
}

export interface VideoMessage extends BaseMessage {
  MsgType: 'video'
  MediaId: string
  ThumbMediaId: string
}

export interface EventMessage extends BaseMessage {
  MsgType: 'event'
  Event: 'subscribe' | 'unsubscribe'
}

export interface LocationMessage extends BaseMessage {
  MsgType: 'location'
  Location_X: number
  Location_Y: number
  Scale: number
  Label: string
}

export interface BaseSendMessage {
  ToUserName: string
  FromUserName: string
  CreateTime: number
}

export type SendMessage = TextSendMessage | ImageSendMessage

export interface TextSendMessage extends BaseSendMessage {
  MsgType: 'text'
  Content: string
}

export interface ImageSendMessage extends BaseSendMessage {
  MsgType: 'image'
  Image: {
    MediaId: string
  }
}
