import { createServer } from 'node:net';

import { Connection, TcpipBindInfo } from 'ssh2';
export function createTcpServer(client: Connection, info: TcpipBindInfo) {
  return createServer(function (socket) {
    console.log('Client connected to forwarded port');
    // Get the remote address and port of the connected client
    console.log('Remote address: ' + socket.remoteAddress + ':' + socket.remotePort);
    client.forwardOut(info.bindAddr, info.bindPort, socket.remoteAddress, socket.remotePort, (err, remoteSocket) => {
      if (err) {
        console.log('FIRST :: forwardOut error: ' + err);
        return client.end();
      }

      remoteSocket.pipe(socket);
      socket.pipe(remoteSocket);
    });
  });
}
