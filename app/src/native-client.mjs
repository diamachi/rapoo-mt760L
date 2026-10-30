import { validateReport, toHex } from './protocol.mjs';
export class NativeTransport {
  constructor(request, log) { this.request = request; this.log = log; this.device = null; }
  async status() { const status = await this.request('/api/native/status'); this.token = status.token; return status; }
  async connect() {
    const status = await this.status();
    if (status.error) throw Error(status.error);
    const device = status.devices.find(d => d.compatible);
    if (!device) throw Error('Cannot find the MT760L configuration interface (24ae:1870, report BA). Reconnect the 2.4 GHz receiver.');
    const result = await this.request('/api/native/connect', { token: this.token, body: { id: device.id } });
    this.device = result.device; return this.device;
  }
  async send(bytes) {
    validateReport(bytes); if (!this.device) throw Error('Connect the receiver first');
    await this.request('/api/native/send', { token: this.token, body: { id: this.device.id, hex: toHex(bytes) } });
    this.log('SENT · UNVERIFIED', toHex(bytes));
  }
  async close() {
    if (this.token) await this.request('/api/native/disconnect', { token: this.token, body: {} });
    this.device = null;
  }
}
