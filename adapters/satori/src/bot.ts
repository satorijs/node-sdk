import { Bot, Context, h, Quester, snakeCase, Universal } from '@satorijs/satori'

export function transformKey(source: any, callback: (key: string) => string) {
  if (!source || typeof source !== 'object') return source
  if (Array.isArray(source)) return source.map(value => transformKey(value, callback))
  return Object.fromEntries(Object.entries(source).map(([key, value]) => {
    if (key.startsWith('_')) return [key, value]
    return [callback(key), transformKey(value, callback)]
  }))
}

function createInternal(bot: SatoriBot, prefix = '') {
  return new Proxy(() => {}, {
    apply(target, thisArg, args) {
      return bot.http.post('/internal/' + snakeCase(prefix.slice(1)), args, {
        headers: {
          'X-Platform': bot.platform,
          'X-Self-ID': bot.selfId
        }
      })
    },
    get(target, key, receiver) {
      if (typeof key === 'symbol' || key in target) {
        return Reflect.get(target, key, receiver)
      }
      return createInternal(bot, prefix + '.' + key)
    },
  })
}

export class SatoriBot<C extends Context = Context> extends Bot<C, Universal.Login> {
  public http: Quester
  public internal = createInternal(this)

  constructor(ctx: C, config: Universal.Login) {
    super(ctx, config, 'satori')
    Object.assign(this, config)
  }
}

for (const [key, method] of Object.entries(Universal.Methods)) {
  SatoriBot.prototype[method.name] = function (this: SatoriBot, ...args: any[]) {
    const payload = {}
    for (const { name } of method.fields) {
      if (name === 'content') {
        payload[name] = h.normalize(args.shift()).join('')
      } else {
        payload[name] = transformKey(args.shift(), snakeCase)
      }
    }
    this.logger.debug('[request]', key, payload)
    return this.http.post('/v1/' + key, payload, {
      headers: {
        'X-Platform': this.platform,
        'X-Self-ID': this.selfId
      }
    })
  }
}
