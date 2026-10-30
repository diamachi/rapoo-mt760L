// Run only with the project Node: node --experimental-ffi app/native/macos-hid.mjs list|probe|send [registry-id] [hex]
// No package, compiler, driver, installation, event tap, input callback, or exclusive device access.
import { DynamicLibrary, toBuffer } from 'node:ffi';
import { parseHidDescriptor, hasConfigurationReport } from '../src/hid-descriptor.mjs';
import { fromHex, validateReport } from '../src/protocol.mjs';
const cf = new DynamicLibrary('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation');
const io = new DynamicLibrary('/System/Library/Frameworks/IOKit.framework/IOKit');
const bind = (lib, name, result, args) => lib.getFunction(name, { return: result, arguments: args });
const f = {
  release: bind(cf, 'CFRelease', 'void', ['pointer']),
  string: bind(cf, 'CFStringCreateWithCString', 'pointer', ['pointer', 'string', 'u32']),
  stringGet: bind(cf, 'CFStringGetCString', 'u8', ['pointer', 'pointer', 'i64', 'u32']),
  number: bind(cf, 'CFNumberCreate', 'pointer', ['pointer', 'i32', 'pointer']),
  numberGet: bind(cf, 'CFNumberGetValue', 'u8', ['pointer', 'i32', 'pointer']),
  type: bind(cf, 'CFGetTypeID', 'u64', ['pointer']),
  numberType: bind(cf, 'CFNumberGetTypeID', 'u64', []), stringType: bind(cf, 'CFStringGetTypeID', 'u64', []), dataType: bind(cf, 'CFDataGetTypeID', 'u64', []),
  dict: bind(cf, 'CFDictionaryCreateMutable', 'pointer', ['pointer', 'i64', 'pointer', 'pointer']),
  dictSet: bind(cf, 'CFDictionarySetValue', 'void', ['pointer', 'pointer', 'pointer']),
  setCount: bind(cf, 'CFSetGetCount', 'i64', ['pointer']), setValues: bind(cf, 'CFSetGetValues', 'void', ['pointer', 'pointer']),
  dataLength: bind(cf, 'CFDataGetLength', 'i64', ['pointer']), dataBytes: bind(cf, 'CFDataGetBytePtr', 'pointer', ['pointer']),
  manager: bind(io, 'IOHIDManagerCreate', 'pointer', ['pointer', 'u32']),
  match: bind(io, 'IOHIDManagerSetDeviceMatching', 'void', ['pointer', 'pointer']),
  devices: bind(io, 'IOHIDManagerCopyDevices', 'pointer', ['pointer']),
  property: bind(io, 'IOHIDDeviceGetProperty', 'pointer', ['pointer', 'pointer']),
  service: bind(io, 'IOHIDDeviceGetService', 'u32', ['pointer']),
  registryId: bind(io, 'IORegistryEntryGetRegistryEntryID', 'i32', ['u32', 'pointer']),
  open: bind(io, 'IOHIDDeviceOpen', 'i32', ['pointer', 'u32']),
  close: bind(io, 'IOHIDDeviceClose', 'i32', ['pointer', 'u32']),
  send: bind(io, 'IOHIDDeviceSetReport', 'i32', ['pointer', 'i32', 'i64', 'pointer', 'i64']),
};
const keys = new Map();
function key(name) { if (!keys.has(name)) keys.set(name, f.string(null, name, 0x08000100)); return keys.get(name); }
function property(device, name) {
  const value = f.property(device, key(name)); if (!value) return null;
  const type = f.type(value);
  if (type === f.numberType()) { const b = Buffer.alloc(8); return f.numberGet(value, 4, b) ? Number(b.readBigInt64LE()) : null; }
  if (type === f.stringType()) { const b = Buffer.alloc(1024); return f.stringGet(value, b, 1024n, 0x08000100) ? b.toString('utf8').split('\0')[0] : null; }
  if (type === f.dataType()) { const size = Number(f.dataLength(value)); if (size > 65536) throw Error('HID descriptor is too large'); return size ? toBuffer(f.dataBytes(value), size) : Buffer.alloc(0); }
  return null;
}
function check(code, operation) {
  if (!code) return;
  const hex = '0x' + (code >>> 0).toString(16);
  const help = (code >>> 0) === 0xe00002e2 || (code >>> 0) === 0xe00002c1 ? ' macOS denied HID access. Check whether macOS requests Input Monitoring permission for the app launching the portable Node runtime; no permission was changed automatically.' : '';
  throw Error(`${operation} failed (${hex}).${help}`);
}
let manager = 0n, dictionary = 0n, set = 0n;
try {
  const command = process.argv[2] || 'list';
  if (!['list', 'probe', 'send'].includes(command)) throw Error('Unsupported native operation');
  manager = f.manager(null, 0); if (!manager) throw Error('Unable to create HID manager');
  dictionary = f.dict(null, 0n, cf.getSymbol('kCFTypeDictionaryKeyCallBacks'), cf.getSymbol('kCFTypeDictionaryValueCallBacks'));
  for (const [name, value] of [['VendorID', 0x24ae], ['ProductID', 0x1870]]) {
    const b = Buffer.alloc(4); b.writeInt32LE(value); const n = f.number(null, 3, b); f.dictSet(dictionary, key(name), n); f.release(n);
  }
  f.match(manager, dictionary); set = f.devices(manager);
  const devices = [];
  if (set) {
    const count = Number(f.setCount(set)); if (count > 64) throw Error('Unexpected HID device count');
    const pointers = Buffer.alloc(count * 8); f.setValues(set, pointers);
    for (let i = 0; i < count; i++) {
      const pointer = pointers.readBigUInt64LE(i * 8), descriptor = property(pointer, 'ReportDescriptor');
      const collections = descriptor ? parseHidDescriptor(descriptor) : [];
      const id = Buffer.alloc(8); check(f.registryId(f.service(pointer), id), 'Read registry ID');
      devices.push({ pointer, id: id.readBigUInt64LE().toString(), productName: property(pointer, 'Product'), vendorId: property(pointer, 'VendorID'), productId: property(pointer, 'ProductID'),
        usagePage: property(pointer, 'PrimaryUsagePage'), usage: property(pointer, 'PrimaryUsage'), transport: property(pointer, 'Transport'),
        maxOutputReportSize: property(pointer, 'MaxOutputReportSize'), collections, descriptorHex: descriptor?.toString('hex'), compatible: hasConfigurationReport(collections) });
    }
  }
  const publicInfo = ({ pointer, ...info }) => info;
  if (command === 'list') console.log(JSON.stringify({ devices: devices.map(publicInfo) }));
  else {
    const target = devices.find(d => d.id === process.argv[3] && d.compatible);
    if (!target) throw Error('The MT760L receiver configuration interface is no longer attached. Reconnect the receiver.');
    check(f.open(target.pointer, 0), 'Open MT760L configuration interface');
    try {
      if (command === 'send') {
        const bytes = validateReport(fromHex(process.argv[4] || ''));
        // IOHID expects the FULL report, including ID, unlike WebHID.
        check(f.send(target.pointer, 1, 0xban, bytes, 32n), 'Send output report BA');
      }
      console.log(JSON.stringify({ device: publicInfo(target), status: command === 'send' ? 'sent-unverified' : 'opened', reportsSent: command === 'send' ? 1 : 0 }));
    } finally { f.close(target.pointer, 0); }
  }
} catch (error) { console.log(JSON.stringify({ error: error.message })); process.exitCode = 1; }
finally {
  if (set) f.release(set); if (dictionary) f.release(dictionary); if (manager) f.release(manager);
  for (const value of keys.values()) f.release(value);
  // macOS framework handles intentionally stay loaded until process exit.
}
