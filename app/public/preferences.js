// Runs before styles paint. Theme preference is local to this browser.
(() => {
  let theme; try { theme=localStorage.getItem('rapoo-theme'); } catch {}
  document.documentElement.dataset.theme=theme==='dark'||theme==='light'?theme:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
})();
