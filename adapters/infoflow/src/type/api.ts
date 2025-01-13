import { Internal } from './internal'
import { SendMessage } from './index'

Internal.define({
  '/msg/groupmsgsend': {
    POST: 'sendGroupMessage',
  },
})

declare module './internal' {
  interface Internal {
    /**
     * 发送群消息
     * @see https://qy.baidu.com/doc/index.html#/inner_serverapi/robot?id=%e5%8f%91%e9%80%81%e6%b6%88%e6%81%af-1
     */
    sendGroupMessage(query?: SendMessage)
  }
}
