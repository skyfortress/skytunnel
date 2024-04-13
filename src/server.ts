import 'dotenv/config';

import { readFileSync } from 'fs';
import net from 'net';
import { Server } from 'ssh2';
import { inspect } from 'util';

import { startHttpsServer } from './lib/web';

startHttpsServer();

new Server(
  {
    hostKeys: [readFileSync(process.env.SSH_HOST_KEY)],
  },
  (client) => {
    console.log('Client connected!');

    client
      .on('authentication', (ctx) => {
        ctx.accept();
      })
      .on('ready', () => {
        console.log('Client authenticated!');

        client.on('request', (accept, reject, name, info) => {
          if (name === 'tcpip-forward') {
            accept();
            console.log('Client wants to execute: ' + inspect(info));

            const server = net.createServer(function (socket) {
              console.log('Client connected to forwarded port');
              // Get the remote address and port of the connected client
              console.log('Remote address: ' + socket.remoteAddress + ':' + socket.remotePort);
              client.forwardOut(
                info.bindAddr,
                info.bindPort,
                socket.remoteAddress,
                socket.remotePort,
                (err, remoteSocket) => {
                  if (err) {
                    console.log('FIRST :: forwardOut error: ' + err);
                    return client.end();
                  }

                  remoteSocket.pipe(socket);
                  socket.pipe(remoteSocket);
                },
              );
            });
            console.log('TCP listening to: ' + info.bindAddr + ':' + info.bindPort);
            server.listen(info.bindPort, '127.0.0.1');
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
            session.write('Your address is abc.tunnel.skyfortress.dev!\r\n');

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
