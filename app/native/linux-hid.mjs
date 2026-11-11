import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, readdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { parseHidDescriptor } from '../src/hid-descriptor.mjs';
import { decodeBatteryReport } from '../src/battery.mjs';

export const linuxHidHelper = fileURLToPath(new URL('./linux-hid', import.meta.url));
const exec = promisify(execFile);

export async function linuxReceivers(sysfs = '/sys/class/hidraw') {
  const names = await readdir(sysfs).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  const devices = [];
  for (const name of names.filter(name => /^hidraw\d+$/.test(name)).sort()) {
    const deviceDir = join(sysfs, name, 'device');
    const uevent = await readFile(join(deviceDir, 'uevent'), 'utf8').catch(() => '');
    if (!/^HID_ID=0003:000024AE:00001870$/im.test(uevent)) continue;
    const location = await realpath(deviceDir).catch(() => null);
    if (!location) continue;
    const descriptor = await readFile(join(location, 'report_descriptor')).catch(() => Buffer.alloc(0));
    const id = createHash('sha256').update(location).update(descriptor).digest().readBigUInt64BE().toString();
    let compatible = false;
    try {
      compatible = parseHidDescriptor(descriptor).some(c => c.usagePage === 0xff00 && c.usage === 0x0e &&
        c.outputReports.some(r => r.reportId === 0xba && r.bits === 248));
    } catch { /* A malformed or unavailable descriptor cannot qualify. */ }
    devices.push({ path: '/dev/' + name, descriptor, info: {
      id, compatible, vendorId: 0x24ae, productId: 0x1870, productName: 'Rapoo MT760L receiver',
      outputReportBytes: compatible ? 32 : null, reportId: compatible ? 0xba : null,
      detectionError: compatible ? null : 'No supported vendor output report BA in this HID interface',
    } });
  }
  return devices;
}

export async function runLinuxHid(operation, id, hex) {
  const devices = await linuxReceivers();
  if (operation === 'list') return { devices: devices.map(d => d.info) };
  if (!['probe', 'send', 'battery'].includes(operation)) throw Error('Unsupported Linux HID operation');
  const device = devices.find(d => d.info.id === id && d.info.compatible);
  if (!device) throw Error('Compatible receiver not found. Reconnect the 2.4 GHz receiver.');
  const args = [operation, device.path, device.descriptor.toString('hex')];
  if (operation === 'send') args.push(hex);
  let stdout;
  try {
    ({ stdout } = await exec(linuxHidHelper, args, { timeout: 5000, maxBuffer: 4096 }));
  } catch (error) {
    throw Error(error.stderr?.trim() || 'Linux receiver operation failed or timed out.');
  }
  if (operation === 'battery') {
    const raw = Buffer.from(stdout.trim(), 'hex');
    if (raw[0] !== 0xba || ![4, 32].includes(raw.length)) throw Error('Mouse did not return a valid battery report');
    const payload = raw.length === 4 ? raw.subarray(1) : Buffer.concat([raw.subarray(1), Buffer.alloc(1)]);
    decodeBatteryReport(payload);
    return { batteryReport: payload.toString('hex') };
  }
  return { device: device.info, status: operation === 'send' ? 'sent-unverified' : 'opened' };
}
