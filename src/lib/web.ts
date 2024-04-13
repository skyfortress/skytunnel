import { readFileSync } from 'node:fs';

import httpProxy from 'http-proxy';
import https from 'https';

export function startHttpsServer() {
  const proxy = httpProxy.createProxyServer({});

  const server = https.createServer(
    {
      key: readFileSync('/etc/letsencrypt/live/tunnel.skyfortress.dev/privkey.pem'),
      cert: readFileSync('/etc/letsencrypt/live/tunnel.skyfortress.dev/fullchain.pem'),
    },
    function (req, res) {
      console.log('Request received', req.headers);
      if (req.headers.host === 'abc.tunnel.skyfortress.dev') {
        proxy.web(req, res, { target: 'http://127.0.0.1:8082' });
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    },
  );

  console.log('listening on port 443');
  server.listen(443);
}
