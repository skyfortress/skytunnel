import { readFileSync } from 'node:fs';
import path from 'node:path';

import express from 'express';
import httpProxy from 'http-proxy';
import https from 'https';

export function startHttpsServer(connectedClients: any) {
  //TODO: Fix any type
  const proxy = httpProxy.createProxyServer({ ws: true });
  const app = express();
  app.use(express.static(path.join(__dirname, '../../public')));
  app.get('/', (req, res) => {
    res.sendFile('index.html');
  });

  const privateKey = readFileSync('/etc/letsencrypt/live/skytunnel.run/privkey.pem', 'utf8');
  const certificate = readFileSync('/etc/letsencrypt/live/skytunnel.run/cert.pem', 'utf8');
  const ca = readFileSync('/etc/letsencrypt/live/skytunnel.run/fullchain.pem', 'utf8');

  const server = https.createServer(
    {
      key: privateKey,
      cert: certificate,
      ca: ca,
    },
    function (req, res) {
      if (req.headers.host === 'skytunnel.run') {
        return app(req, res);
      }
      console.log('Request received', req.headers);

      const connectedClient = connectedClients[req.headers.host];
      if (connectedClient) {
        const proxyTarget = `http://127.0.0.1:${connectedClient.port}`;
        console.log('Proxying request to', proxyTarget);
        proxy.web(req, res, { target: proxyTarget });
        proxy.on('error', function (err) {
          console.error(err);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Something went wrong.');
        });
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    },
  );

  server.on('upgrade', function (req, socket, head) {
    console.log('Upgrade request received', req.headers);
    const connectedClient = connectedClients[req.headers.host];
    if (connectedClient) {
      const proxyTarget = `ws://127.0.0.1:${connectedClient.port}`;
      console.log('Proxying request to', proxyTarget);
      proxy.ws(req, socket, head, { target: proxyTarget });
    }
  });

  console.log('listening on port 443');
  server.listen(443);
}
