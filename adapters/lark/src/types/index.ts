export * from './internal'

export * from './auth'
export * from './event'
export * from './guild'
export * from './message'

export namespace Feishu {
  /**
   * A user in Feishu has several different IDs.
   * @see https://open.larksuite.com/document/home/user-identity-introduction/introduction
   */
  export interface UserIds {
    union_id: string
    /** *user_id* only available when the app has permissions granted by the administrator */
    user_id?: string
    open_id: string
  }

  /**
   * Identify a user in Feishu.
   * This behaves like {@link Feishu.UserIds}, but it only contains *open_id*.
   * (i.e. the id_type is always `open_id`)
   */
  export interface UserIdentifiers {
    id: string
    id_type: string
  }

  export type UserIdType = 'union_id' | 'user_id' | 'open_id'
  /**
   * The id type when specify a receiver, would be used in the request query.
   *
   * NOTE: we always use **open_id** to identify a user, use **chat_id** to identify a channel.
   * @see https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
   */
  export type ReceiveIdType = UserIdType | 'email' | 'chat_id'
}
