// MT760 setter: DLL 6feb8140–6feb81c2, address field 0x358 => 0x630.
// Base rate table at 6fd90632 is 08 04 02 01 for 125/250/500/1000 Hz.
import { addressOf, validateReport } from './protocol.mjs';
export const POLLING_RATES = [125, 250, 500, 1000];
const codes = [8, 4, 2, 1];
export function encodePolling(hz, template) {
  const index = POLLING_RATES.indexOf(hz);
  if (index < 0) throw Error('Choose 125, 250, 500 or 1000 Hz');
  const bytes = template ? template.slice() : new Uint8Array(32);
  if (template && !validPolling(template)) throw Error('Expected a captured polling-rate block');
  bytes.set([0xba, 0xa5, 0xa5, 4, 0x30, 6, 0, 0]);
  bytes[8] = codes[index]; bytes[9] = codes[index];
  if (!template) { bytes[10] = 255; bytes[11] = 255; }
  return bytes;
}
export function validPolling(bytes) {
  try { validateReport(bytes); } catch { return false; }
  return addressOf(bytes) === 0x630 && bytes[2] === 0xa5 && bytes[3] === 4 &&
    codes.includes(bytes[8]) && bytes[9] === bytes[8] && bytes[10] === 255 && bytes[11] === 255 &&
    !bytes.slice(12).some(x => x !== 0);
}
