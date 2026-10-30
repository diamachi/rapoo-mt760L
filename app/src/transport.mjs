import { REPORT_ID, validateReport, toHex } from './protocol.mjs';
export function reportCollections(collections) {
  return collections.flatMap(c => [c, ...reportCollections(c.children || [])]);
}
export class WebHidTransport {
  constructor(hid, log) { this.hid = hid; this.log = log; this.device = null; }
  async connect() {
    if (!this.hid) throw Error('WebHID is unavailable. Open localhost in desktop Chrome or Edge.');
    const [device] = await this.hid.requestDevice({ filters: [] });
    if (!device) throw Error('No device selected');
    // Do not guess the VID/PID: the capture has no returned device descriptor.
    const compatible = reportCollections(device.collections).some(c => c.usagePage >= 0xff00 && c.outputReports?.some(r => r.reportId === REPORT_ID && r.items.reduce((n, i) => n + i.reportSize * i.reportCount, 0) === 248));
    if (!compatible) throw Error('Selected device has no accessible vendor output report 0xBA with 31 data bytes. Export its descriptor for investigation.');
    await device.open(); this.device = device;
    this.onInput = e => this.log('INPUT (unparsed)', `ID ${e.reportId.toString(16)} · ${toHex(new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength))}`);
    device.addEventListener('inputreport', this.onInput);
    this.onDisconnect = e => { if (e.device === this.device) { this.device = null; this.log('DISCONNECTED', 'Receiver removed'); this.hid.removeEventListener('disconnect', this.onDisconnect); this.onLost?.(); } };
    this.hid.addEventListener('disconnect', this.onDisconnect);
    return device;
  }
  async send(bytes) {
    validateReport(bytes);
    if (!this.device?.opened) throw Error('Connect the receiver first');
    await this.device.sendReport(REPORT_ID, bytes.slice(1));
    this.log('SENT · UNVERIFIED', toHex(bytes));
    // WebHID has no GET_REPORT(Input) API. A resolved send is NOT device readback.
  }
  async close() {
    if (this.device) {
      this.device.removeEventListener('inputreport', this.onInput);
      await this.device.close();
    }
    this.hid?.removeEventListener('disconnect', this.onDisconnect); this.device = null;
  }
}
