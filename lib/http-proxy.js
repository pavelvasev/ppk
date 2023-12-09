#!/usr/bin/env node

// https://en.wikipedia.org/wiki/HTTP_tunnel#HTTP_CONNECT_Tunneling
// https://github.com/apify/proxy-chain
// https://www.npmjs.com/package/https-proxy-agent

// todo проверить что открывая тут порт он снаружи по инету на умт недоступен

import ProxyChain from 'proxy-chain';

const server = new ProxyChain.Server({ port: 14000 });

server.listen(() => {
    console.log(`Proxy server is listening on port ${8000}`,server.server.address());
});