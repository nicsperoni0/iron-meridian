import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
for (const s of [192, 512]) { await p.setViewportSize({ width: s, height: s });
 await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100"><rect width="100" height="100" fill="#0b141c"/><circle cx="50" cy="50" r="34" fill="none" stroke="#c9a24a" stroke-width="3"/><path d="M50 18v64M18 50h64" stroke="#c9a24a55" stroke-width="2"/><g fill="#e8f1ff"><rect x="30" y="46" width="8" height="18"/><rect x="40" y="34" width="9" height="30"/><rect x="51" y="40" width="8" height="24"/><rect x="61" y="50" width="8" height="14"/></g><path d="M50 70l-14 0 14 12 14-12z" fill="#c9a24a"/></svg></body>`);
 await p.screenshot({ path: `public/icon-${s}.png` }); }
await b.close();
