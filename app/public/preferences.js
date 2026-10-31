// Runs before styles paint. Theme preference is local to this browser.
(() => {
  let size;try{size=localStorage.getItem('openrapoo-ui-scale');}catch{}
  document.documentElement.dataset.uiScale=['large','extra-large'].includes(size)?size:'auto';
  let theme; try { theme=localStorage.getItem('rapoo-theme'); } catch {}
  document.documentElement.dataset.theme=theme==='dark'||theme==='light'?theme:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
})();
