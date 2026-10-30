// Full USB report includes ID at offset 0. WebHID sends that ID separately.
export const REPORT_ID = 0xba;
export function fromHex(hex) {
  const clean = hex.replace(/\s/g, '');
  if (!/^(?:[\da-f]{2})+$/i.test(clean)) throw Error('Expected complete hexadecimal bytes');
  return Uint8Array.from(clean.match(/../g), x => parseInt(x, 16));
}
export function toHex(bytes) { return Array.from(bytes, x => x.toString(16).padStart(2, '0')).join(' '); }
export function validateReport(bytes) {
  if (bytes.length !== 32 || bytes[0] !== REPORT_ID || bytes[1] !== 0xa5 || ![0xa4, 0xa5].includes(bytes[2])) throw Error('Unsupported MT760L report');
  return bytes;
}
export function addressOf(bytes) { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true); }
export function decodeDpi(bytes) {
  validateReport(bytes);
  if (addressOf(bytes) !== 0x638 || bytes[2] !== 0xa5 || bytes[3] !== 20) throw Error('Expected captured DPI block at 0x638');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { stages: Array.from({ length: 6 }, (_, i) => view.getUint16(8 + i * 2, true) * 50), count: bytes[22] + 1, current: bytes[24] + 1 };
}
export function encodeDpi(template, { stages, count, current }) {
  decodeDpi(template);
  if (!Number.isInteger(count) || count < 1 || count > 6 || !Number.isInteger(current) || current < 1 || current > count) throw Error('Current stage must be within the enabled stage count');
  if (stages.length !== 6 || stages.some((x, i) => !Number.isInteger(x) || (i >= count && x === 0 ? false : x < 50 || x > 4000 || x % 50))) throw Error('Enter six DPI stages, 50–4000 in steps of 50 (disabled slots may be zero)');
  const out = template.slice(), view = new DataView(out.buffer);
  stages.forEach((dpi, i) => view.setUint16(8 + i * 2, dpi / 50, true));
  out[22] = count - 1; out[24] = current - 1;
  return out;
}
export function capturedWrite(packet) {
  if (packet.setup?.requestType !== 0x21 || packet.setup.request !== 9 || packet.setup.value !== 0x2ba || packet.setup.interface !== 1) return false;
  try { const b = validateReport(fromHex(packet.payload)); return b[2] === 0xa5 && [0x638, 0x648, 0x630, 0x610].includes(addressOf(b)); } catch { return false; }
}
