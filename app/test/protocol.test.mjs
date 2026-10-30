import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeCapture } from '../../scripts/decode-capture.mjs';
import { fromHex, toHex, decodeDpi, encodeDpi, capturedWrite } from '../src/protocol.mjs';
import { WebHidTransport } from '../src/transport.mjs';
// Rebuild a synthetic USBPcap stream from the stripped protocol fixture.
// This exercises the parser without shipping the original capture or host metadata.
const fixture = JSON.parse(readFileSync(new URL('../data/protocol-fixture.json', import.meta.url)));
function block(type, body) {
  const size = 12 + Math.ceil(body.length / 4) * 4, b = Buffer.alloc(size);
  b.writeUInt32LE(type); b.writeUInt32LE(size, 4); body.copy(b, 8); b.writeUInt32LE(size, size - 4); return b;
}
const section = Buffer.alloc(16); section.writeUInt32LE(0x1a2b3c4d); section.writeUInt16LE(1, 4);
const iface = Buffer.alloc(8); iface.writeUInt16LE(249); iface.writeUInt32LE(65535, 4);
const buffer = Buffer.concat([block(0x0a0d0d0a, section), block(1, iface), ...fixture.map(p => {
  const data = Buffer.alloc(8 + (p.payload?.length || 0) / 2);
  if (p.setup) { data[0]=p.setup.requestType; data[1]=p.setup.request; data.writeUInt16LE(p.setup.value,2); data.writeUInt16LE(p.setup.interface,4); data.writeUInt16LE(p.setup.length,6); Buffer.from(p.payload,'hex').copy(data,8); }
  const usb=Buffer.alloc(28+data.length); usb.writeUInt16LE(28); usb[16]=p.completion?1:0; usb[21]=p.endpoint; usb[22]=p.transfer; usb.writeUInt32LE(data.length,23); usb[27]=p.stage??0; data.copy(usb,28);
  const packet=Buffer.alloc(20+usb.length); packet.writeUInt32LE(usb.length,12); packet.writeUInt32LE(usb.length,16); usb.copy(packet,20); return block(6,packet);
})]);
const packets = decodeCapture(buffer);
test('USB capture evidence: packet count, control transfer type and absent responses', () => {
  assert.equal(packets.length, 107);
  assert.ok(packets.every(p => !p.completion));
  const p = packets[11];
  assert.deepEqual(p.setup, { requestType: 0x21, request: 9, value: 0x2ba, interface: 1, length: 32 });
  assert.equal(fromHex(p.payload).length, 32);
  assert.equal(packets.filter(capturedWrite).length, 12);
});
test('DPI decoding agrees with captured stage edits, and roundtrips byte-for-byte', () => {
  const expected = new Map([[12, [[800, 1000, 1200, 1700, 3200, 4000], 6, 4]], [16, [[800, 1000, 1200, 1700, 4000, 0], 5, 4]], [20, [[800, 1000, 1200, 1700, 4000, 800], 6, 4]], [28, [[800, 1000, 1200, 1700, 4000, 1600], 6, 6]]]);
  for (const [frame, [stages, count, current]] of expected) {
    const bytes = fromHex(packets[frame - 1].payload), decoded = decodeDpi(bytes);
    assert.deepEqual(decoded, { stages, count, current }); assert.deepEqual(encodeDpi(bytes, decoded), bytes);
  }
});
test('one stage edit changes only its two value bytes', () => {
  const bytes = fromHex(packets[11].payload), state = decodeDpi(bytes); state.stages[0] = 1600;
  const edited = encodeDpi(bytes, state); assert.equal(edited[8], 32);
  assert.deepEqual(edited.slice(10), bytes.slice(10)); assert.deepEqual(edited.slice(0, 8), bytes.slice(0, 8));
});
test('rejects malformed capture and invalid parameter values', () => {
  assert.throws(() => decodeCapture(buffer.subarray(0, 220)));
  assert.throws(() => fromHex('ba gg')); assert.throws(() => fromHex('b'));
  const b = fromHex(packets[11].payload), s = decodeDpi(b);
  for (const invalid of [0, -50, 75, 4050, NaN]) assert.throws(() => encodeDpi(b, { ...s, stages: [invalid, ...s.stages.slice(1)] }));
  assert.throws(() => encodeDpi(b, { ...s, current: 7 }));
  assert.throws(() => encodeDpi(b, { ...s, count: 0 }));
});
test('WebHID sends output, strips ID once, and never claims verified success', async () => {
  const events = [], calls = [], listeners = new Map();
  const device = { collections: [{ usagePage: 0xff00, outputReports: [{ reportId: 0xba, items: [{ reportSize: 8, reportCount: 31 }] }], children: [] }],
    async open() { this.opened = true; }, async close() { this.opened = false; }, async sendReport(...args) { calls.push(args); },
    addEventListener() {}, removeEventListener() {} };
  const hid = { async requestDevice() { return [device]; }, addEventListener(k, v) { listeners.set(k, v); }, removeEventListener(k) { listeners.delete(k); } };
  const transport = new WebHidTransport(hid, (...args) => events.push(args));
  await transport.connect(); assert.equal(calls.length, 0);
  const bytes = fromHex(packets[11].payload); await transport.send(bytes);
  assert.equal(calls[0][0], 0xba); assert.equal(calls[0][1].length, 31); assert.equal(calls[0][1][0], 0xa5);
  assert.equal(events[0][0], 'SENT · UNVERIFIED'); assert.equal(events[0][1], toHex(bytes));
  await transport.close(); await assert.rejects(transport.send(bytes), /Connect/); assert.equal(listeners.size, 0);
});
test('refuses mouse collections and incompatible report sizes', async () => {
  for (const [usagePage, reportCount] of [[1, 31], [0xff00, 32]]) {
    let opened = false;
    const t = new WebHidTransport({ requestDevice: async () => [{ collections: [{ usagePage, outputReports: [{ reportId: 0xba, items: [{ reportSize: 8, reportCount }] }] }], open() { opened = true; } }] }, () => {});
    await assert.rejects(t.connect(), /no accessible vendor/); assert.equal(opened, false);
  }
});
