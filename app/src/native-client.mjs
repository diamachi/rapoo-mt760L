import { validateReport, toHex } from './protocol.mjs';
export class NativeTransport {
  constructor(request, log) { this.request = request; this.log = log; this.device = null; }
  async status() { const status = await this.request('/api/native/status'); this.token = status.token; return status; }
  async connect() {
    const status = await this.status();
    if (status.error) throw Error(status.error);
    const device = status.devices.find(d => d.compatible);
    if (!device) {
      this.log('RECEIVER SCAN', JSON.stringify({ devices: status.devices }));
      const found = status.devices.length;
      throw Error(found
        ? `Found ${found} MT760L HID interface(s), but none exposes the supported configuration report BA. Export device details from Developer mode for diagnosis.`
        : 'The system did not expose an MT760L receiver (24ae:1870). Reconnect the 2.4 GHz receiver, then scan again.');
    }
    const result = await this.request('/api/native/connect', { token: this.token, body: { id: device.id } });
    this.device = result.device; return this.device;
  }
  async send(bytes, {confirmPrimaryClick=false}={}) {
    validateReport(bytes); if (!this.device) throw Error('Connect the receiver first');
    await this.request('/api/native/send', { token: this.token, body: { id: this.device.id, hex: toHex(bytes),confirmPrimaryClick } });
    this.log('SENT · UNVERIFIED', toHex(bytes));
  }
  async battery() {
    if(!this.device)throw Error('Connect the receiver first');
    return this.request('/api/native/battery',{token:this.token,body:{id:this.device.id}});
  }
  async close() {
    if (this.token) await this.request('/api/native/disconnect', { token: this.token, body: {} });
    this.device = null;
  }
}
