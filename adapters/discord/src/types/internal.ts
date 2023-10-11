import { Dict, Logger, makeArray, Quester } from '@satorijs/satori'

const logger = new Logger('discord')

export class Internal {
  constructor(private http: Quester) {}

  static define(routes: Dict<Partial<Record<Quester.Method, string | string[]>>>) {
    for (const path in routes) {
      for (const key in routes[path]) {
        const method = key as Quester.Method
        for (const name of makeArray(routes[path][method])) {
          Internal.prototype[name] = async function (this: Internal, ...args: any[]) {
            const raw = args.join(', ')
            const url = path.replace(/\{([^}]+)\}/g, () => {
              if (!args.length) throw new Error(`too few arguments for ${path}, received ${raw}`)
              return args.shift()
            })
            const config: Quester.AxiosRequestConfig = {}
            if (args.length === 1) {
              if (method === 'GET' || method === 'DELETE') {
                config.params = args[0]
              } else {
                config.data = args[0]
              }
            } else if (args.length === 2 && method !== 'GET' && method !== 'DELETE') {
              config.data = args[0]
              config.params = args[1]
            } else if (args.length > 1) {
              throw new Error(`too many arguments for ${path}, received ${raw}`)
            }
            try {
              logger.debug(`${method} ${url}`, config)
              return await this.http(method, url, config)
            } catch (error) {
              if (!Quester.isAxiosError(error) || !error.response) throw error
              throw new Error(`[${error.response.status}] ${JSON.stringify(error.response.data)}`)
            }
          }
        }
      }
    }
  }
}
