import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fromHex, validateReport, addressOf } from './src/protocol.mjs';
import { allowedParameterWrite } from './src/buttons.mjs';
import { ScrollService } from './scroll-service.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const exec = promisify(execFile);
export async function runNative(operation, ...args) {
  try {
    const { stdout } = await exec(process.execPath, ['--experimental-ffi', path.join(root, 'native/macos-hid.mjs'), operation, ...args], { timeout: 8000, maxBuffer: 1024 * 1024 });
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
export function createAppServer({ native = runNative, platform = process.platform, scroll = new ScrollService() } = {}) {
  const token = randomBytes(32).toString('hex'); let connectedId = null;
  const server = createServer(async (req, res) => {
    const host = req.headers.host;
    if (!host || !/^127\.0\.0\.1:\d+$/.test(host)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store');
    try {
      const url = new URL(req.url, `http://${host}`);
      const json = (data, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
      if (req.method === 'GET' && url.pathname === '/api/info') { json({ app: 'rapoo-local', version: '0.1.0' }); return; }
      if (url.pathname.startsWith('/api/native/')) {
        if (req.method === 'GET' && url.pathname === '/api/native/scroll-status') { json(scroll.status()); return; }
        if (req.method === 'GET' && url.pathname === '/api/native/status') {
          if (platform !== 'darwin') { json({ available: false }); return; }
          try { json({ available: true, token, scroll: scroll.status(), ...(await native('list')) }); }
          catch (error) { json({ available: true, token, devices: [], error: error.message }); }
          return;
        }
        if (req.method !== 'POST') { json({ error: 'Method not allowed' }, 405); return; }
        const supplied = Buffer.from(req.headers['x-rapoo-token'] || '');
        if (req.headers.origin !== `http://${host}` || supplied.length !== token.length || !timingSafeEqual(supplied, Buffer.from(token))) { json({ error: 'Local session authorization required. Reload the app.' }, 403); return; }
        if (platform !== 'darwin') { json({ error: 'Native macOS transport is unavailable' }, 400); return; }
        try {
          const body = await readJson(req);
          if (url.pathname === '/api/native/scroll-start') { json(await scroll.start(body.lines)); return; }
          if (url.pathname === '/api/native/scroll-stop') { json(await scroll.stop()); return; }
          if (url.pathname === '/api/native/disconnect') { connectedId = null; json({ disconnected: true }); return; }
          if (typeof body.id !== 'string' || !/^\d{1,20}$/.test(body.id)) throw Error('Invalid receiver ID');
          if (url.pathname === '/api/native/connect') { connectedId = null; const result = await native('probe', body.id); connectedId = result.device.id; json(result); return; }
          if (url.pathname === '/api/native/send') {
            if (body.id !== connectedId) throw Error('Connect the receiver first');
            if (typeof body.hex !== 'string') throw Error('Expected report bytes');
            const bytes = validateReport(fromHex(body.hex));
            if (!allowedParameterWrite(bytes)) throw Error('Only supported parameter writes are allowed');
            json(await native('send', body.id, Buffer.from(bytes).toString('hex'))); return;
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
      const routes = { '/': 'public/index.html', '/style.css': 'public/style.css', '/controls.css': 'public/controls.css', '/mouse-map.css':'public/mouse-map.css', '/polish.css':'public/polish.css', '/preferences.js':'public/preferences.js', '/mouse-map.mjs':'public/mouse-map.mjs', '/assets/mouse.svg':'public/assets/mouse.svg', '/app.mjs': 'public/app.mjs', '/src/protocol.mjs': 'src/protocol.mjs', '/src/transport.mjs': 'src/transport.mjs', '/src/native-client.mjs': 'src/native-client.mjs', '/src/buttons.mjs': 'src/buttons.mjs' };
      const file = routes[url.pathname];
      if (!file) { res.writeHead(404).end('Not found'); return; }
      res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.webp') ? 'image/webp' : 'text/javascript');
      res.end(await readFile(path.join(root, file)));
    } catch (error) { console.error(error); res.writeHead(500).end('Unable to load local project data'); }
  });
  server.on('close',()=>{scroll.stop().catch(()=>{});});
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createAppServer();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(Number(process.env.RAPOO_PORT || 8760), '127.0.0.1', () => console.log(`Rapoo Local → http://127.0.0.1:${server.address().port}\nOpen in desktop Chrome / Edge. Ctrl+C stops the local server.`));
}
