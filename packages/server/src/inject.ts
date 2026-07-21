/**
 * The live-reload client injected into served pages (never into exported
 * files). Server-Sent Events: `reload` when a valid rebuild lands — its
 * payload lists WHICH pages changed, so only affected tabs reload (the hash
 * preserves camera + selection across the reload); `invalid` shows the
 * diagnostics banner without touching the last good diagram.
 */
export const LIVE_CLIENT = `
<style>
.m-live-banner {
  position: fixed; left: 50%; bottom: 18px; translate: -50% 0; z-index: 60;
  max-width: min(720px, 92vw); background: #2a1215f0; border: 1px solid #e5484d;
  color: #ffd7d9; border-radius: 10px; padding: 10px 14px; font: 12.5px/1.5 ui-monospace, monospace;
  white-space: pre-wrap; backdrop-filter: blur(8px);
}
:root[data-theme="light"] .m-live-banner { background: #fff0f0f5; color: #8c1d18; }
</style>
<script>
(() => {
  const es = new EventSource('/api/events');
  let banner;
  const clearBanner = () => { banner?.remove(); banner = undefined; };
  es.addEventListener('reload', (ev) => {
    let payload;
    try { payload = JSON.parse(ev.data); } catch { /* legacy plain-stamp payload */ }
    const page = document.documentElement.dataset.page || 'index.html';
    // pages:null = site shape changed, everyone reloads; otherwise only tabs
    // showing a page that actually changed
    if (!payload || !Array.isArray(payload.pages) || payload.pages.includes(page)) location.reload();
  });
  es.addEventListener('invalid', (ev) => {
    clearBanner();
    banner = document.createElement('div');
    banner.className = 'm-live-banner';
    banner.textContent = ev.data;
    document.body.append(banner);
  });
  es.addEventListener('valid', clearBanner);
})();
</script>`;
