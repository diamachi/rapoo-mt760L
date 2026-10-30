// Owned exclusively by the desktop window. No shell or browser is launched.
import { createAppServer } from '../app/server.mjs';
const server = createAppServer();
const parent = Number(process.env.RAPOO_PARENT_PID);
if (!Number.isInteger(parent) || parent < 1) throw Error('Desktop parent PID required');
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(Number(process.env.RAPOO_PORT || 8765), '127.0.0.1');
const monitor = setInterval(() => {
  try { process.kill(parent, 0); } catch { server.close(); process.exit(0); }
}, 1000);
monitor.unref();
for (const signal of ['SIGTERM','SIGINT']) process.once(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
});
