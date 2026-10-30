// Scans qCompress/zlib resources without executing the vendor application.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
const input = readFileSync(new URL('../rapoo-re/A HUB.exe', import.meta.url));
const out = new URL('../research/generated/profile-candidates/', import.meta.url); mkdirSync(out, { recursive: true });
let candidates = 0, streams = 0;
for (let i = 0; i < input.length - 6; i++) {
  if (input[i] !== 0x78 || ![0x01, 0x5e, 0x9c, 0xda].includes(input[i + 1])) continue;
  try {
    const { buffer, engine } = inflateSync(input.subarray(i, i + 8 * 1024 * 1024), { maxOutputLength: 16 * 1024 * 1024, info: true }); streams++;
    const text = buffer.toString('utf8');
    if (buffer.length < 2 * 1024 * 1024 && (/import QtQuick|MT760|ScrollGrids|"MouseKeyList"|"keyID"|"KeyID"/.test(text) || /^[\s\ufeff]*[\[{]/.test(text))) {
      const name = i.toString(16) + '.txt'; writeFileSync(new URL(name, out), buffer);
      candidates++;
    }
    i += Math.max(0, engine.bytesWritten - 1);
  } catch {}
}
console.log({ streams, candidates });
