// No packages required. USBPcap layout: https://desowin.org/usbpcap/captureformat.html
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export function decodeCapture(buffer) {
  const packets = []; const interfaces = []; let le = true;
  const u16 = (b, o) => le ? b.readUInt16LE(o) : b.readUInt16BE(o);
  const u32 = (b, o) => le ? b.readUInt32LE(o) : b.readUInt32BE(o);
  for (let offset = 0; offset < buffer.length;) {
    if (offset + 12 > buffer.length) throw Error(`Truncated block at ${offset}`);
    if (buffer.readUInt32LE(offset) === 0x0a0d0d0a) {
      le = buffer.readUInt32LE(offset + 8) === 0x1a2b3c4d;
      interfaces.length = 0;
    }
    const type = u32(buffer, offset), length = u32(buffer, offset + 4);
    if (length < 12 || length % 4 || offset + length > buffer.length || u32(buffer, offset + length - 4) !== length) throw Error(`Invalid block at ${offset}`);
    const b = buffer.subarray(offset, offset + length);
    if (type === 1) interfaces.push(u16(b, 8));
    if (type === 6) {
      if (length < 32) throw Error('Truncated packet block');
      const iface = u32(b, 8), size = u32(b, 20);
      if (28 + size > length - 4) throw Error('Truncated packet');
      if (interfaces[iface] !== 249) throw Error('Expected LINKTYPE_USBPCAP (249)');
      const p = b.subarray(28, 28 + size);
      if (p.length < 27) throw Error('Truncated USBPcap header');
      const header = p.readUInt16LE(0), dataLength = p.readUInt32LE(23);
      if (header < 27 || header + dataLength > p.length) throw Error('Truncated USB payload');
      const data = p.subarray(header, header + dataLength);
      const packet = { frame: packets.length + 1, timestamp: (u32(b, 12) * 2 ** 32 + u32(b, 16)) / 1e6,
        irp: p.subarray(2, 10).toString('hex'), status: p.readUInt32LE(10), completion: Boolean(p[16] & 1),
        bus: p.readUInt16LE(17), device: p.readUInt16LE(19), endpoint: p[21], transfer: p[22],
        stage: p[22] === 2 ? p[27] : null, data: data.toString('hex') };
      if (packet.transfer === 2 && packet.stage === 0 && data.length >= 8) {
        packet.setup = { requestType: data[0], request: data[1], value: data.readUInt16LE(2), interface: data.readUInt16LE(4), length: data.readUInt16LE(6) };
        packet.payload = data.subarray(8).toString('hex');
      }
      packets.push(packet);
    }
    offset += length;
  }
  return packets;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const packets = decodeCapture(readFileSync(process.argv[2] || 'rapoo-re/rapoo_760l_config.pcapng'));
  if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(packets, null, 2) + '\n');
  else for (const p of packets) console.log(p.frame, p.completion ? 'IN ' : 'OUT', `ep=${p.endpoint.toString(16)}`, p.setup || '', p.payload ?? p.data);
}
