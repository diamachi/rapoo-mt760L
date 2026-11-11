import { app, BrowserWindow, dialog, nativeTheme, session } from 'electron';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createAppServer } from './app/server.mjs';

const smoke = process.argv.includes('--smoke-test');
const server = createAppServer({ platform: smoke ? 'unsupported' : process.platform });
let window;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window?.isMinimized()) window.restore(); window?.focus(); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { server.close(); server.closeAllConnections(); });
  app.whenReady().then(async () => {
    const port = await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(smoke ? 0 : 8765, '127.0.0.1', () => resolve(server.address().port));
    });
    const url = `http://127.0.0.1:${port}/`;
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: !details.url.startsWith(url) && !details.url.startsWith('blob:' + url) });
    });
    window = new BrowserWindow({
      width: 1120, height: 860, minWidth: 520, minHeight: 440, title: 'OpenRapoo', show: !smoke,
      icon: fileURLToPath(new URL('./app-icon.png', import.meta.url)),
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#20242e' : '#edf0f5',
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.on('closed', () => { window = undefined; });
    await window.loadURL(url);
    if (smoke) {
      let ready = false;
      for (let attempt = 0; attempt < 50 && !ready; attempt++) {
        ready = await window.webContents.executeJavaScript(
          "document.querySelectorAll('.dpi-stage').length === 6 && document.title.includes('OpenRapoo')"
        );
        if (!ready) await delay(100);
      }
      if (!ready) throw Error('App did not render the expected DPI controls');
      console.log('Linux desktop smoke test passed');
      app.quit();
    }
  }).catch(error => {
    if (smoke) console.error(error.message);
    else dialog.showErrorBox('OpenRapoo could not start', error.message);
    app.exit(1);
  });
}
