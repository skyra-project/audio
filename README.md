# @skyra/audio

[![GitHub](https://img.shields.io/github/license/skyra-project/audio)](https://github.com/skyra-project/audio/blob/main/LICENSE.md)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/skyra-project/audio.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/skyra-project/audio/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/skyra-project/audio.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/skyra-project/audio/context:javascript)
[![Coverage Status](https://coveralls.io/repos/github/skyra-project/audio/badge.svg?branch=main)](https://coveralls.io/github/skyra-project/audio?branch=main)
[![Depfu](https://badges.depfu.com/badges/f67681c7b5f9b8357a4ab749f381f5da/count.svg)](https://depfu.com/github/skyra-project/audio?project_id=17045)
[![npm](https://img.shields.io/npm/v/@skyra/audio?color=crimson&label=NPM&logo=npm&style=flat-square)](https://www.npmjs.com/package/@skyra/audio)
![npm bundle size minified (scoped)](https://img.shields.io/bundlephobia/min/@skyra/audio?label=minified&logo=webpack)

**Table of Contents**

-   [@skyra/audio](#skyraaudio)
    -   [About](#about)
    -   [Installation and Usage](#installation-and-usage)
        -   [Package managers](#package-managers)
            -   [Usage](#usage)
    -   [Meta](#meta)
        -   [License](#license)
        -   [Contributing](#contributing)
        -   [Buy us some doughnuts](#buy-us-some-doughnuts)
        -   [Contributors ✨](#contributors-%E2%9C%A8)

## About

-   A JavaScript wrapper for the [Lavalink](https://github.com/Frederikam/Lavalink) audio client for Discord. Only supports Lavalink v3.
-   This is a derivative work of [lavalink.js](https://github.com/lavalibs/lavalink.js), this wouldn't be possible without the author's work.

## Installation and Usage

### Package managers

```bash
yarn add @skyra/audio
# or npm install @skyra/audio
```

#### Usage

```js
const { Node } = require('@skyra/audio');

const node = new Node({
	password: '', // your Lavalink password
	userID: '', // the user ID of your bot
	shardCount: 0, // the total number of shards that your bot is running (optional, useful if you're load balancing)
	hosts: {
		rest: '', // the http host of your lavalink instance (optional)
		ws: '' // the ws host of your lavalink instance (optional)
	},
	host: '', // a URL to your lavalink instance without protocol (optional, can be used instead of specifying hosts option)
},
	(guildID, packet) => {
		const guild = client.guilds.cache.get(guildID);
		if (guild) return guild.shard.send(packet);
	})
await node.connect();

// This sends the required raw Voice State and Voice 
// Sever data to lavalink so it can make a connection.
client.ws.on("VOICE_STATE_UPDATE", async (data) => {
	try {
		await client.lavalink.voiceStateUpdate(data);
	} catch (error) {
		console.error(error);
	}
});

client.ws.on("VOICE_SERVER_UPDATE", async (data) => {
	try {
		await node.voiceServerUpdate(data);
	} catch (error) {
		console.error(error);
	}
});
```

```ts
import { Node } from '@skyra/audio';

// Same as before
```

## Meta

### License

Copyright © 2020, [Skyra Project](https://github.com/skyra-project).
Released under the [MIT License](LICENSE.md).

### Contributing

1. Fork it!
1. Create your feature branch: `git checkout -b my-new-feature`
1. Commit your changes: `git commit -am 'Add some feature'`
1. Push to the branch: `git push origin my-new-feature`
1. Submit a pull request!

### Buy us some doughnuts

Skyra Project is open source and always will be, even if we don't get donations. That said, we know there are amazing people who
may still want to donate just to show their appreciation. Thanks you very much in advance!

We accept donations through Patreon, BitCoin, Ethereum, and Litecoin. You can use the buttons below to donate through your method of choice.

| Donate With |         QR         |                                                                  Address                                                                  |
| :---------: | :----------------: | :---------------------------------------------------------------------------------------------------------------------------------------: |
|   Patreon   | ![PatreonImage][]  |                                               [Click Here](https://donate.skyra.pw/patreon)                                               |
|   PayPal    |  ![PayPalImage][]  |                                               [Click Here](https://donate.skyra.pw/paypal)                                                |
|   BitCoin   | ![BitcoinImage][]  |         [3JNzCHMTFtxYFWBnVtDM9Tt34zFbKvdwco](bitcoin:3JNzCHMTFtxYFWBnVtDM9Tt34zFbKvdwco?amount=0.01&label=Skyra%20Discord%20Bot)          |
|  Ethereum   | ![EthereumImage][] | [0xcB5EDB76Bc9E389514F905D9680589004C00190c](ethereum:0xcB5EDB76Bc9E389514F905D9680589004C00190c?amount=0.01&label=Skyra%20Discord%20Bot) |
|  Litecoin   | ![LitecoinImage][] |         [MNVT1keYGMfGp7vWmcYjCS8ntU8LNvjnqM](litecoin:MNVT1keYGMfGp7vWmcYjCS8ntU8LNvjnqM?amount=0.01&label=Skyra%20Discord%20Bot)         |

[patreonimage]: https://cdn.skyra.pw/gh-assets/patreon.png
[paypalimage]: https://cdn.skyra.pw/gh-assets/paypal.png
[bitcoinimage]: https://cdn.skyra.pw/gh-assets/bitcoin.png
[ethereumimage]: https://cdn.skyra.pw/gh-assets/ethereum.png
[litecoinimage]: https://cdn.skyra.pw/gh-assets/litecoin.png

### Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/kyranet"><img src="https://avatars0.githubusercontent.com/u/24852502?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Antonio Román</b></sub></a><br /><a href="https://github.com/skyra-project/audio/commits?author=kyranet" title="Code">💻</a> <a href="https://github.com/skyra-project/audio/commits?author=kyranet" title="Tests">⚠️</a> <a href="#ideas-kyranet" title="Ideas, Planning, & Feedback">🤔</a> <a href="#infra-kyranet" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
    <td align="center"><a href="https://favware.tech/"><img src="https://avatars3.githubusercontent.com/u/4019718?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Jeroen Claassens</b></sub></a><br /><a href="https://github.com/skyra-project/audio/commits?author=Favna" title="Code">💻</a> <a href="#infra-Favna" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-Favna" title="Maintenance">🚧</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
