// The native hosts accept only this small appearance message from the local page.
export function syncNativeAppearance(theme, host=globalThis) {
  if(theme!=='dark'&&theme!=='light')return;
  const message={type:'appearance',theme};
  try{host.webkit?.messageHandlers?.appearance?.postMessage(message);}catch{}
  try{host.chrome?.webview?.postMessage(message);}catch{}
}
