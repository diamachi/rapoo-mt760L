// Read-only inspection of supplied inputs; outputs only under research/generated/.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodeCapture } from './decode-capture.mjs';
import { fromHex, addressOf, capturedWrite, decodeDpi } from '../app/src/protocol.mjs';
const generated = new URL('../research/generated/', import.meta.url);
mkdirSync(generated, { recursive: true });
const input = name => new URL('../rapoo-re/' + name, import.meta.url);
const hash = name => { const bytes = readFileSync(input(name)); return { file: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }; };
const packets = decodeCapture(readFileSync(input('rapoo_760l_config.pcapng')));
const summary = {
  files: ['rapoo_760l_config.pcapng', 'RapooDevice.dll', 'A HUB.exe'].map(hash),
  packetCount: packets.length, completionCount: packets.filter(p => p.completion).length,
  writes: packets.filter(capturedWrite).map(p => ({ frame: p.frame, address: '0x' + addressOf(fromHex(p.payload)).toString(16), payload: p.payload, ...(addressOf(fromHex(p.payload)) === 0x638 ? { dpi: decodeDpi(fromHex(p.payload)) } : {}) })),
};
writeFileSync(new URL('manifest.json', generated), JSON.stringify(summary, null, 2) + '\n');
writeFileSync(new URL('capture-decoded.json', generated), JSON.stringify(packets, null, 2) + '\n');

const dll = readFileSync(input('RapooDevice.dll')), pe = dll.readUInt32LE(0x3c);
if (dll.toString('ascii', pe, pe + 4) !== 'PE\0\0' || dll.readUInt16LE(pe + 24) !== 0x10b) throw Error('Expected PE32 DLL');
const imageBase = dll.readUInt32LE(pe + 24 + 28);
const sectionStart = pe + 24 + dll.readUInt16LE(pe + 20);
const sections = Array.from({ length: dll.readUInt16LE(pe + 6) }, (_, i) => {
  const o = sectionStart + i * 40;
  return { name: dll.toString('ascii', o, o + 8).replace(/\0/g, ''), virtualSize: dll.readUInt32LE(o + 8), rva: dll.readUInt32LE(o + 12), rawSize: dll.readUInt32LE(o + 16), raw: dll.readUInt32LE(o + 20) };
});
const raw = rva => { const s = sections.find(s => rva >= s.rva && rva < s.rva + s.rawSize); if (!s) throw Error('RVA outside file-backed section'); return s.raw + rva - s.rva; };
const str = o => dll.toString('ascii', o, dll.indexOf(0, o));
const exportDir = raw(dll.readUInt32LE(pe + 24 + 96));
const functions = raw(dll.readUInt32LE(exportDir + 28)), names = raw(dll.readUInt32LE(exportDir + 32)), ordinals = raw(dll.readUInt32LE(exportDir + 36));
const exports = Array.from({ length: dll.readUInt32LE(exportDir + 24) }, (_, i) => {
  const name = str(raw(dll.readUInt32LE(names + i * 4))), index = dll.readUInt16LE(ordinals + i * 2);
  return { name, va: '0x' + (imageBase + dll.readUInt32LE(functions + index * 4)).toString(16) };
});
const strings = [];
for (const section of sections.filter(s => s.name === '.rdata')) {
  const bytes = dll.subarray(section.raw, section.raw + section.rawSize).toString('latin1');
  for (const match of bytes.matchAll(/[\x20-\x7e]{4,}/g)) if (/MT760|DPIList|CurDpiGear|DpiCurrentLevel|^Size$|HidD_/.test(match[0])) strings.push({ text: match[0], offset: '0x' + (section.raw + match.index).toString(16), va: '0x' + (imageBase + section.rva + match.index).toString(16) });
}
writeFileSync(new URL('dll-inventory.json', generated), JSON.stringify({ imageBase: '0x' + imageBase.toString(16), sections, exports, strings }, null, 2) + '\n');
const disassembly = new URL('RapooDevice.disassembly.txt', generated);
if (existsSync(disassembly)) {
  const ranges = [[0x6fd9dcb8, 0x6fd9dd24], [0x6feafcd0, 0x6feafe29], [0x6feb2530, 0x6feb288b]];
  const lines = readFileSync(disassembly, 'utf8').split('\n').filter(line => {
    const match = line.match(/^([\da-f]+):/); if (!match) return false;
    const va = parseInt(match[1], 16); return ranges.some(([start, end]) => va >= start && va < end);
  });
  writeFileSync(new URL('dpi-evidence.asm', generated), '; Generated excerpts from the supplied DLL; addresses are VAs.\n' + lines.join('\n') + '\n');
}
console.log(`Evidence written under research/generated/: ${packets.length} packets, ${summary.completionCount} completions, ${exports.length} named PE exports.`);
