import * as QQ from '../types'
import { GroupInternal } from '.'

declare module './index' {
  interface GroupInternal {
    sendMessage(channel_id: string, data: QQ.Message.Request): Promise<{
      id: string
      timestamp: string
    } & {
      code: number
      message: string
      data: any
    }>
    sendPrivateMessage(openid: string, data: QQ.Message.Request): Promise<any>
    sendFilePrivate(openid: string, data: QQ.Message.File.Request): Promise<any>
    sendFileGuild(group_openid: string, data: QQ.Message.File.Request): Promise<any>
    acknowledgeInteraction(interaction_id: string, code: number): Promise<any>
  }
}

GroupInternal.define(false, {
  '/v2/groups/{channel.id}/messages': {
    POST: 'sendMessage',
  },
  '/v2/users/{user.id}/messages': {
    POST: 'sendPrivateMessage',
  },
  '/v2/users/{user.id}/files': {
    POST: 'sendFilePrivate',
  },
  '/v2/groups/{channel.id}/files': {
    POST: 'sendFileGuild',
  },
  '/interactions/{interaction.id}/{interaction.token}/callback': {
    POST: 'acknowledgeInteraction',
  },
})
