import { readFileSync } from 'node:fs';
const dll = readFileSync(new URL('../rapoo-re/RapooDevice.dll', import.meta.url));
const lines = readFileSync(new URL('../research/generated/RapooDevice.disassembly.txt', import.meta.url), 'utf8').split('\n');
const [start, end] = process.argv.slice(2).map(x => parseInt(x, 16));
for (const line of lines) {
  const match = line.match(/^([\da-f]+):/); if (!match) continue;
  const address = parseInt(match[1], 16); if (address < start || address >= end) continue;
  let text = line.replace(/^[^\t]+\t/, '').replace(/ <[^>]+>/g, '');
  const values = [...text.matchAll(/0x([\da-f]{8})/g)];
  for (const v of values) { const raw = parseInt(v[1], 16) - 0x6fd02800;
    if (raw >= 0x2a8800 && raw < 0x2d42f0) { const end = dll.indexOf(0, raw); const s = dll.subarray(raw, Math.min(end, raw + 100)).toString('latin1'); if (/^[\x20-\x7e]{2,}$/.test(s)) text += ` ; ${s}`; }
  }
  console.log(match[1] + ': ' + text);
}
