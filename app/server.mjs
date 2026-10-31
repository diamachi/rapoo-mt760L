import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fromHex, validateReport, addressOf } from './src/protocol.mjs';
import { allowedParameterWrite, requiresPrimaryClickConsent } from './src/buttons.mjs';
import { summarizeRate } from './src/rate-stats.mjs';
import { decodeBatteryReport } from './src/battery.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const exec = promisify(execFile);
const rateExecutable = existsSync(path.join(root, 'native/macos-rate')) ? path.join(root, 'native/macos-rate') : path.resolve(root, '../_toolchain/build-cache/macos-rate');
export async function runRateMeasurement() {
  try {
    const { stdout } = await exec(rateExecutable, [], { timeout: 10000, maxBuffer: 1024 * 1024 });
    const sample = JSON.parse(stdout); if (sample.error) throw Error(sample.error);
    return summarizeRate(sample);
  } catch (error) {
    let message; try { message = JSON.parse(error.stdout).error; } catch {}
    throw Error(message || error.message);
  }
}
export async function runNative(operation, ...args) {
  try {
    const windows = process.platform === 'win32';
    const executable = windows ? path.join(root, 'native/windows-hid.exe') : process.execPath;
    const arguments_ = windows ? [operation, ...args] : ['--experimental-ffi', path.join(root, 'native/macos-hid.mjs'), operation, ...args];
    const { stdout } = await exec(executable, arguments_, { timeout: 8000, maxBuffer: 1024 * 1024, windowsHide: true });
    return JSON.parse(stdout);
  } catch (error) {
    let message; try { message = JSON.parse(error.stdout).error; } catch {}
    throw Error(message || `Native receiver access failed: ${error.message}`);
  }
}
async function readJson(req) {
  let text = ''; for await (const chunk of req) { text += chunk; if (text.length > 4096) throw Error('Request body too large'); }
  return JSON.parse(text || '{}');
}
export function createAppServer({ native = runNative, platform = process.platform, measure = runRateMeasurement, development = false, inputMonitoringRequired = process.env.RAPOO_INPUT_MONITORING_REQUIRED === '1' } = {}) {
  const nativeAvailable = platform === 'darwin' || (platform === 'win32' && (native !== runNative || existsSync(path.join(root, 'native/windows-hid.exe'))));
  const measurementAvailable = platform === 'darwin' && (measure !== runRateMeasurement || existsSync(rateExecutable));
  const token = randomBytes(32).toString('hex'); let connectedId = null, measuring = false, batteryReading = false, writing = false;
  let batteryCache=null;
  const server = createServer(async (req, res) => {
    const host = req.headers.host;
    if (!host || !/^127\.0\.0\.1:\d+$/.test(host)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store');
    try {
      const url = new URL(req.url, `http://${host}`);
      const json = (data, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
      if (req.method === 'GET' && url.pathname === '/api/info') { json({ app: 'openrapoo', version, development, inputMonitoringRequired: platform === 'darwin' && inputMonitoringRequired }); return; }
      if (url.pathname.startsWith('/api/native/')) {
        if (!['status', 'connect', 'send', 'disconnect', 'measure-rate', 'battery'].some(name => url.pathname === '/api/native/' + name)) { json({ error: 'Not found' }, 404); return; }
        if (req.method === 'GET' && url.pathname === '/api/native/status') {
          if (!nativeAvailable) { json({ available: false, platform }); return; }
          try { json({ available: true, token, platform, measurementAvailable, ...(await native('list')) }); }
          catch (error) { json({ available: true, token, platform, measurementAvailable, devices: [], error: error.message }); }
          return;
        }
        if (req.method !== 'POST') { json({ error: 'Method not allowed' }, 405); return; }
        const supplied = Buffer.from(req.headers['x-rapoo-token'] || '');
        if (req.headers.origin !== `http://${host}` || supplied.length !== token.length || !timingSafeEqual(supplied, Buffer.from(token))) { json({ error: 'Local session authorization required. Reload the app.' }, 403); return; }
        if (!nativeAvailable) { json({ error: 'Native transport is unavailable' }, 400); return; }
        try {
          const body = await readJson(req);
          if (url.pathname === '/api/native/measure-rate') {
            if (!measurementAvailable) throw Error('Native report measurement is available in the local macOS preview.');
            if (measuring || batteryReading || writing) { json({ error: 'A receiver operation is already running' }, 409); return; }
            measuring = true;
            try { json(await measure()); } finally { measuring = false; }
            return;
          }
          if (url.pathname === '/api/native/disconnect') { connectedId = null; batteryCache=null; json({ disconnected: true }); return; }
          if (typeof body.id !== 'string' || !/^\d{1,20}$/.test(body.id)) throw Error('Invalid receiver ID');
          if (url.pathname === '/api/native/battery') {
            if (body.id !== connectedId) throw Error('Connect the receiver first');
            if (measuring || batteryReading || writing) throw Error('Wait for the receiver operation to finish');
            if(batteryCache?.id===body.id && Date.now()-batteryCache.time<15000){json(batteryCache.value);return;}
            batteryReading=true;
            try {
              const result=await native('battery',body.id);
              const value={...decodeBatteryReport(fromHex(result.batteryReport)),updatedAt:new Date().toISOString()};
              batteryCache={id:body.id,time:Date.now(),value};json(value);
            } finally {batteryReading=false;}
            return;
          }
          if (url.pathname === '/api/native/connect') { connectedId = null; const result = await native('probe', body.id); connectedId = result.device.id; json(result); return; }
          if (url.pathname === '/api/native/send') {
            if (measuring || batteryReading || writing) throw Error('Wait for the receiver measurement or battery read/write to finish before changing settings');
            if (body.id !== connectedId) throw Error('Connect the receiver first');
            if (typeof body.hex !== 'string') throw Error('Expected report bytes');
            const bytes = validateReport(fromHex(body.hex));
            if (!allowedParameterWrite(bytes)) throw Error('Only supported parameter writes are allowed');
            if(requiresPrimaryClickConsent(bytes) && body.confirmPrimaryClick!==true)throw Error('Unlock the primary-click assignment before applying this change');
            writing=true;
            try {json(await native('send', body.id, Buffer.from(bytes).toString('hex')));} finally {writing=false;}
            return;
          }
          json({ error: 'Not found' }, 404);
        } catch (error) { json({ error: error.message }, 400); }
        return;
      }
      if (req.method !== 'GET') { res.writeHead(405).end(); return; }
      if (url.pathname === '/api/capture') {
        const packets = JSON.parse(await readFile(path.join(root, 'data/protocol-fixture.json'), 'utf8'));
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(packets)); return;
      }
      const routes = { '/fonts.css':'public/fonts.css', '/assets/fonts/dm-sans-latin.woff2':'public/assets/fonts/dm-sans-latin.woff2', '/assets/fonts/dm-serif-display-latin.woff2':'public/assets/fonts/dm-serif-display-latin.woff2', '/assets/fonts/dm-serif-display-italic-latin.woff2':'public/assets/fonts/dm-serif-display-italic-latin.woff2', '/appearance.mjs':'public/appearance.mjs', '/layout.css':'public/layout.css', '/action-picker.mjs':'public/action-picker.mjs', '/': 'public/index.html', '/style.css': 'public/style.css', '/controls.css': 'public/controls.css', '/mouse-map.css':'public/mouse-map.css', '/polish.css':'public/polish.css', '/preferences.js':'public/preferences.js', '/mouse-map.mjs':'public/mouse-map.mjs', '/assets/mt760l.webp':'public/assets/mt760l.webp', '/assets/app-icon.svg':'public/assets/app-icon.svg', '/app.mjs': 'public/app.mjs', '/src/protocol.mjs': 'src/protocol.mjs', '/src/transport.mjs': 'src/transport.mjs', '/src/native-client.mjs': 'src/native-client.mjs', '/src/buttons.mjs': 'src/buttons.mjs', '/src/polling.mjs': 'src/polling.mjs' };
      const file = routes[url.pathname];
      if (!file) { res.writeHead(404).end('Not found'); return; }
      res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css' : file.endsWith('.woff2') ? 'font/woff2' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.webp') ? 'image/webp' : 'text/javascript');
      res.end(await readFile(path.join(root, file)));
    } catch (error) { console.error(error); res.writeHead(500).end('Unable to load local project data'); }
  });
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createAppServer();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(Number(process.env.RAPOO_PORT || 8760), '127.0.0.1', () => console.log(`OpenRapoo → http://127.0.0.1:${server.address().port}\nOpen in desktop Chrome / Edge. Ctrl+C stops the local server.`));
}
