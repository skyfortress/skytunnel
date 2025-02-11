import { createHash } from 'node:crypto';

import { WORDS_LIST } from './misc/words';

export function generateWordFromStr(str: string) {
  const hash = createHash('sha256').update(str).digest('hex');
  const hashedInt = BigInt('0x' + hash);
  const wordIndex = Number(hashedInt % BigInt(WORDS_LIST.length));

  return WORDS_LIST[wordIndex];
}
