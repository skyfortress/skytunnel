import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { inspect } from 'node:util';

import { Server } from 'ssh2';

import { generateDomainFromConnection } from './lib/domain';
import { createTcpServer, getRandomPort } from './lib/tcp';
import { startHttpServer } from './lib/web';

const connectedClients = {};

startHttpServer(connectedClients);

new Server(
  {
    hostKeys: [process.env.SSH_HOST_KEY],
  },
  (client) => {
    console.log('Client connected!', (client as any)._sock._peername.address);

    client
      .on('authentication', (ctx) => {
        ctx.accept();
      })
      .on('ready', () => {
        console.log('Client authenticated!');
        let isForwarded = false;

        client.on('request', (accept, reject, name, info) => {
          console.log('Client wants to execute: ' + name, inspect(info));
          if (name === 'tcpip-forward') {
            accept();
            isForwarded = true;
            if (info.bindPort === 443) {
              const port = getRandomPort();
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
          if (!isForwarded) {
            console.log('Client is not using port forwarding, rejecting session');
            return reject();
          }
          const session = accept();
          session.once('pty', (accept, reject, info) => {
            console.log('Client wants to allocate a pseudo-TTY', inspect(info));
            accept();
          });
          session.once('shell', (accept, reject, info) => {
            console.log('Client wants to allocate a shell', inspect(info));
            const session = accept();
            session.write(`Your address is ${generateDomainFromConnection(client)}!\r\n`);

            session.on('data', () => {
              session.end();
            });
          });
        });
      })
      .on('error', (err) => {
        console.error(err);
      })
      .on('close', () => {
        console.log('Client disconnected');
      });
  },
).listen(parseInt(process.env.SSH_SERVER_PORT), '0.0.0.0', function () {
  console.log('Listening on port ' + this.address().port);
});
