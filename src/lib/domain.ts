import { createHash } from 'node:crypto';

import { Connection } from 'ssh2';

import { WORDS_LIST } from './misc/words';

export function generateDomainFromConnection(connection: Connection, preffered?: string) {
  const ip = (connection as any)._sock._peername.address;
  const word = preffered ?? generateWordFromIP(ip);
  return `${word}.skytunnel.run`; // TODO: Use a proper domain
}

export function generateWordFromIP(ipAddress: string) {
  const hashedIp = createHash('sha256').update(ipAddress).digest('hex');
  const hashedInt = BigInt('0x' + hashedIp);
  const wordIndex = Number(hashedInt % BigInt(WORDS_LIST.length));

  return WORDS_LIST[wordIndex];
}
