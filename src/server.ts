import 'dotenv/config';

import { readFileSync } from 'fs';
import { Server } from 'ssh2';
import { inspect } from 'util';

import { generateDomainFromConnection } from './lib/domain';
import { createTcpServer } from './lib/tcp';
import { startHttpsServer } from './lib/web';

const connectedClients = {};
let currentPort = 1000;
const getProxyPort = () => {
  currentPort += 1;
  return currentPort;
};

startHttpsServer(connectedClients);

new Server(
  {
    hostKeys: [readFileSync(process.env.SSH_HOST_KEY)],
  },
  (client) => {
    console.log('Client connected!', (client as any)._sock._peername.address);
    let domain;

    client
      .on('authentication', (ctx) => {
        ctx.accept();
      })
      .on('ready', () => {
        console.log('Client authenticated!');

        client.on('request', (accept, reject, name, info) => {
          console.log('Client wants to execute: ' + name, inspect(info));
          if (name === 'tcpip-forward') {
            accept();
            if (info.bindPort === 443) {
              const port = getProxyPort();
              const tcpHost = '127.0.0.1';
              const tcpServer = createTcpServer(client, info);
              const domain = generateDomainFromConnection(client);

              connectedClients[domain] = {
                port,
                server: tcpServer,
              };

              tcpServer.listen(port, tcpHost);
              console.log(`TCP listening to: ${tcpHost}:${port}`);
            }
          }
        });
        client.on('session', (accept, reject) => {
          console.log('Client wants to start a session');
          const session = accept();
          session.once('pty', (accept, reject, info) => {
            console.log('Client wants to allocate a pseudo-TTY', inspect(info));
            const stream = accept();
          });
          session.once('shell', (accept, reject, info) => {
            console.log('Client wants to allocate a shell', inspect(info));
            const session = accept();
            session.write(`Your address is ${generateDomainFromConnection(client)}!\r\n`);

            session.on('data', (data) => {
              session.end();
            });
          });
        });
      })
      .on('close', () => {
        console.log('Client disconnected');
      });
  },
).listen(parseInt(process.env.SSH_SERVER_PORT), '0.0.0.0', function () {
  console.log('Listening on port ' + this.address().port);
});
