<div align="center">
  <h1 id="satori">Satori</h1>
  <p>The Universal Messenger Protocol</p>
</div>

## Roadmap

- Infrastructure
  - [x] @satorijs/core
  - [x] @satorijs/element
  - [x] @satorijs/satori
  - [x] @satorijs/protocol
  - [x] @satorijs/plugin-server
- Ecosystem
  - [x] DingTalk (钉钉)
  - [x] Discord
  - [x] KOOK (开黑啦)
  - [x] Lark (飞书)
  - [x] Line
  - [x] Mail
  - [x] Matrix
  - [x] QQ Guild
  - [x] Slack
  - [x] Telegram
  - [x] WhatsApp
  - [x] WeCom (企业微信)
  - [x] Wechat Official (微信公众号)
  - [x] Zulip
  - [x] Infoflow（如流）
## Examples

### Basic usage

```ts
import { Context } from '@satorijs/core'
import discord from '@satorijs/adapter-discord'

// create a new context
const ctx = new Context()

// configure a Discord account
ctx.plugin(discord, {
  token: 'xxxxxx',
})

// listen to message events
ctx.on('message', (session) => {
  console.log(session.content)
})

// start application
await ctx.start()
```

### Specifying protocol

```ts
import { Context } from '@satorijs/core'
import router from '@cordisjs/plugin-server'
import telegram from '@satorijs/adapter-telegram'

// your application will be listening http://localhost:8080
// and be available at https://example.com
const ctx = new Context({
  port: 8080,
  selfUrl: 'https://example.com',
})

// you need a router plugin to handle http requests
ctx.plugin(router)

ctx.plugin(telegram, {
  // telegram supports two ways of connection: server and polling
  protocol: 'server',
  path: '/telegram',
  token: 'xxxxxx',
})
```

### Multiple accounts

```ts
// specify multiple accounts with different platforms and protocols
ctx.plugin(discord, {
  token: 'xxxxxx',
})

ctx.plugin(telegram, {
  protocol: 'server',
  token: 'yyyyyy',
})

ctx.plugin(telegram, {
  protocol: 'polling',
  token: 'zzzzzz',
})
```

### Removing an account

Based on [cordis](https://github.com/shigma/cordis).

```ts
const fork = ctx.plugin(discord, {
  token: 'xxxxxx',
})

fork.dispose()
```
