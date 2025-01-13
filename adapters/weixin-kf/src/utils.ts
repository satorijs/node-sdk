import { Message } from './types'
import { WechatOfficialBot } from './bot'
import { Context, h } from '@satorijs/satori'

export async function decodeMessage<C extends Context>(bot: WechatOfficialBot<C>, message: Message) {
  const session = bot.session()
  // https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Receiving_standard_messages.html
  session.timestamp = message.CreateTime * 1000
  session.wechatOfficial = message
  session.userId = message.FromUserName
  session.channelId = session.userId
  // session.guildId = session.userId
  session.messageId = message.MsgId
  if (message.MsgType === 'text') {
    session.isDirect = true
    session.type = 'message'
    session.elements = [h.text(message.Content)]
    return session
  } else if (message.MsgType === 'image') {
    session.isDirect = true
    session.type = 'message'
    session.elements = [h.image(message.PicUrl)]
    return session
  } else if (message.MsgType === 'voice') {
    session.isDirect = true
    session.type = 'message'
    session.elements = [h.audio(bot.$toMediaUrl(message.MediaId))]
    // https://developers.weixin.qq.com/doc/offiaccount/Asset_Management/Get_temporary_materials.html
    return session
  } else if (message.MsgType === 'video') {
    session.isDirect = true
    session.type = 'message'
    session.elements = [h.video(bot.$toMediaUrl(message.MediaId))]
    // const { video_url } = await bot.getMedia(message.MediaId)
    // session.elements = [h.video(video_url)]
    return session
  } else if (message.MsgType === 'location') {
    session.isDirect = true
    session.type = 'message'
    session.elements = [h('wechat-official:location', {
      latitude: message.Location_X,
      longitude: message.Location_Y,
      label: message.Label,
    })]
    return session
  } else if (message.MsgType === 'event') {
    if (message.Event === 'subscribe') {
      session.type = 'friend-added'
      return session
    } else if (message.Event === 'unsubscribe') {
      session.type = 'friend-deleted'
      return session
    }
  }
}
