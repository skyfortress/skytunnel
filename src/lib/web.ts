import http from 'node:http';
import path from 'node:path';

import express from 'express';
import httpProxy from 'http-proxy';

export function startHttpServer(connectedClients: any) {
  //TODO: Fix any type
  const proxy = httpProxy.createProxyServer({ ws: true });
  const app = express();
  app.use(express.static(path.join(__dirname, '../../public')));
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
  });

  const server = http.createServer(function (req, res) {
    if (['skytunnel.run', 'localhost'].includes(req.headers.host)) {
      return app(req, res);
    }
    console.log('Request received', req.headers);
    console.log(connectedClients);
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
  });

  server.on('upgrade', function (req, socket, head) {
    console.log('Upgrade request received', req.headers);
    const connectedClient = connectedClients[req.headers.host];
    if (connectedClient) {
      const proxyTarget = `ws://127.0.0.1:${connectedClient.port}`;
      console.log('Proxying request to', proxyTarget);
      proxy.ws(req, socket, head, { target: proxyTarget });
    }
  });

  console.log('listening on port 80');
  server.listen(80);
}
