import 'dotenv/config';

import { writeFile } from 'node:fs/promises';
import { Server as TcpServer } from 'node:net';
import { inspect } from 'node:util';

import { Server } from 'ssh2';

import { generateDomainFromConnection } from './lib/domain';
import { createTcpServer, getRandomPort } from './lib/tcp';
import { startHttpServer } from './lib/web';

const connectedClients = {} as { [key: string]: { port: number; server: TcpServer } };

startHttpServer(connectedClients);

new Server(
  {
    hostKeys: [process.env.SSH_HOST_KEY],
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
        let isForwarded = false;

        client.on('request', async (accept, reject, name, info) => {
          console.log('Client wants to execute: ' + name, inspect(info));
          if (name === 'tcpip-forward') {
            accept();
            isForwarded = true;
            if (info.bindPort === 443) {
              const port = getRandomPort();
              const tcpHost = '127.0.0.1';
              const tcpServer = createTcpServer(client, info);
              domain = generateDomainFromConnection(client);

              connectedClients[domain] = {
                port,
                server: tcpServer,
              };

              tcpServer.listen(port, tcpHost);
              console.log(`TCP listening to: ${tcpHost}:${port}`);
              await writeStatsFile();
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
            const msg = `Your address is https://${generateDomainFromConnection(client)}\r\n`;
            console.log(msg);
            session.write(msg);

            session.on('data', () => {
              session.end();
            });
          });
        });
      })
      .on('error', async (err) => {
        if (err.message.includes('Handshake failed')) {
          return;
        }
        delete connectedClients[domain];
        await writeStatsFile();
        console.error(err);
      })
      .on('close', async () => {
        console.log('Client disconnected');
        delete connectedClients[domain];
        await writeStatsFile();
      });
  },
).listen(parseInt(process.env.SSH_SERVER_PORT), '0.0.0.0', function () {
  console.log('Listening on port ' + this.address().port);
});

async function writeStatsFile() {
  await writeFile(
    'stats.json',
    JSON.stringify(
      {
        connectedClients: Object.keys(connectedClients),
      },
      null,
      2,
    ),
  );
}
