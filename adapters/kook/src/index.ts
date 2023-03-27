import { KookBot } from './bot'
import * as Kook from './types'

export { Kook }

export * from './bot'
export * from './message'
export * from './http'
export * from './ws'
export * from './utils'

export default KookBot

declare global {
    namespace Satori {
      interface Events {
        'kook/message-btn-click': {}
      }
    }
}
