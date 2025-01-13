import { Message } from './types'

export * from './bot'
export * from './utils'
export * from './types'
export * from './http'
export * from './message'

declare module '@satorijs/core' {
  interface Session {
    wechatOfficial?: Message
    wechatOfficialResolve?: (value?: any) => void
  }
}
