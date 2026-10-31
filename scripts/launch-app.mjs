// Portable desktop entry point: the terminal owns server lifetime (Ctrl+C to quit).
import { spawn } from 'node:child_process';
import { createAppServer } from '../app/server.mjs';
const port = Number(process.env.RAPOO_PORT || 8760);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid RAPOO_PORT');
const url = `http://127.0.0.1:${port}`;
function openBrowser() {
  const command = process.platform === 'darwin' ? '/usr/bin/open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
  const child = spawn(command, [url], { stdio: 'ignore' });
  child.on('error', () => console.log(`Open ${url} in your browser.`));
  child.unref();
}
const server = createAppServer({ development: true });
server.once('error', async error => {
  if (error.code === 'EADDRINUSE') {
    try {
      const info = await (await fetch(`${url}/api/info`, { signal: AbortSignal.timeout(2000) })).json();
      if (info.app === 'openrapoo') { console.log('OpenRapoo is already running. Opening it.'); openBrowser(); return; }
    } catch {}
  }
  console.error(`Could not start OpenRapoo: ${error.message}\nClose the other process or choose another RAPOO_PORT.`);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`OpenRapoo → ${url}\nKeep this terminal open. Ctrl+C quits this developer server.\nWindows device control requires Chrome or Edge.`);
  openBrowser();
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
});
