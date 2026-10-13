// Pseudo-3D "chess piece" unit tokens, drawn procedurally (original art), cached per type+color+size.
import type { UKey } from './sim';
const cache = new Map<string, HTMLCanvasElement>();
function shade(hsl: string, dl: number) { const m = /hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/.exec(hsl); if (!m) return hsl; return `hsl(${m[1]},${m[2]}%,${Math.max(4, Math.min(92, +m[3] + dl))}%)`; }
export function piece(t: UKey | 'missile', color: string, px: number): HTMLCanvasElement {
  const key = t + color + px; let c = cache.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * 1.25); const g = c.getContext('2d')!; g.scale(px / 64, px / 64); g.lineJoin = 'round'; g.lineCap = 'round';
  const air = ['fighter', 'bomber', 'uav', 'recon', 'loiter', 'awacs'].includes(t);
  // shadow
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(33, 74, 26, 6, 0, 0, 7); g.fill();
  // pedestal: base disk, column, top collar
  const lg = (x0: number, x1: number, a: string, b: string, cc: string) => { const q = g.createLinearGradient(x0, 0, x1, 0); q.addColorStop(0, a); q.addColorStop(0.45, b); q.addColorStop(1, cc); return q; };
  g.fillStyle = lg(8, 56, shade(color, -12), shade(color, 18), shade(color, -22)); g.beginPath(); g.ellipse(32, 68, 24, 7, 0, 0, Math.PI); g.lineTo(8, 63); g.ellipse(32, 63, 24, 7, 0, Math.PI, 0, true); g.closePath(); g.fill();
  g.fillStyle = shade(color, 10); g.beginPath(); g.ellipse(32, 63, 24, 7, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.beginPath(); g.ellipse(32, 63, 23, 6.3, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  if (air) { g.fillStyle = lg(29, 35, shade(color, -15), shade(color, 25), shade(color, -20)); g.fillRect(29.5, 34, 5, 29); }
  else { g.fillStyle = lg(16, 48, shade(color, -15), shade(color, 20), shade(color, -25)); g.beginPath(); g.moveTo(14, 62); g.quadraticCurveTo(22, 54, 20, 46); g.lineTo(44, 46); g.quadraticCurveTo(42, 54, 50, 62); g.closePath(); g.fill();
    g.fillStyle = shade(color, 6); g.beginPath(); g.ellipse(32, 46, 13, 4, 0, 0, 7); g.fill(); }
  // topper: metallic/dark figure with highlight
  const body = (y0: number, y1: number) => { const q = g.createLinearGradient(0, y0, 0, y1); q.addColorStop(0, '#f2f5f7'); q.addColorStop(0.5, '#a9b3ba'); q.addColorStop(1, '#4d575e'); return q; };
  const ink = '#1a2026'; g.strokeStyle = ink; g.lineWidth = 1.6;
  const P = (pts: number[], fill: string | CanvasGradient) => { g.fillStyle = fill; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); g.stroke(); };
  const wheels = (y: number, xs: number[], r = 3) => { for (const x of xs) { g.fillStyle = '#2b3238'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#8a959c'; g.beginPath(); g.arc(x, y, r * 0.4, 0, 7); g.fill(); } };
  switch (t) {
    case 'tank': P([10, 40, 54, 40, 50, 46, 14, 46], body(36, 47)); wheels(43, [17, 25, 33, 41, 48], 2.6); P([20, 40, 22, 31, 40, 30, 44, 40], body(29, 41)); P([40, 33, 60, 31, 60, 34, 40, 36], body(30, 36)); break;
    case 'ifv': P([12, 41, 52, 41, 49, 46, 15, 46], body(34, 47)); P([16, 41, 18, 33, 44, 33, 48, 41], body(32, 42)); wheels(44, [19, 28, 37, 46], 2.8); P([30, 33, 32, 29, 38, 29, 39, 33], body(28, 34)); P([38, 30, 54, 28, 54, 30, 38, 31.5], '#c9d0d5'); break;
    case 'inf': g.fillStyle = body(16, 46); g.beginPath(); g.moveTo(20, 46); g.quadraticCurveTo(20, 30, 32, 29); g.quadraticCurveTo(44, 30, 44, 46); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.arc(32, 23, 7, 0, 7); g.fillStyle = '#d9dfe3'; g.fill(); g.stroke(); g.fillStyle = body(12, 22); g.beginPath(); g.ellipse(32, 19.5, 10, 5.5, 0, Math.PI, 0); g.lineTo(42, 21); g.lineTo(22, 21); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#2b3238'; g.lineWidth = 3; g.beginPath(); g.moveTo(22, 44); g.lineTo(46, 26); g.stroke(); break;
    case 'art': wheels(42, [20, 30], 5); P([14, 40, 40, 40, 36, 45, 18, 45], body(38, 46)); P([24, 38, 54, 18, 56, 21, 27, 41], body(18, 41)); P([36, 41, 46, 46, 44, 47], '#59636a'); break;
    case 'sam': P([10, 42, 52, 42, 52, 46, 10, 46], body(40, 47)); wheels(46, [15, 25, 37, 47], 2.6);
      g.save(); g.translate(30, 40); g.rotate(-0.6); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) P([0 + j * 7, -4 - i * 7, 24 + j * 7, -4 - i * 7, 24 + j * 7, 2 - i * 7, 0 + j * 7, 2 - i * 7], body(-12, 2)); g.restore(); g.fillStyle = '#ff5a3c'; g.beginPath(); g.arc(52, 22, 2.2, 0, 7); g.fill(); break;
    case 'cuas': P([12, 42, 50, 42, 48, 46, 14, 46], body(40, 47)); wheels(46, [18, 30, 42], 2.8); P([22, 42, 24, 32, 38, 32, 40, 42], body(31, 43));
      g.strokeStyle = '#2b3238'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(36, 34); g.lineTo(54, 24); g.moveTo(36, 37); g.lineTo(54, 27); g.stroke(); g.strokeStyle = '#7fe3ff'; g.lineWidth = 1.6; g.beginPath(); g.arc(28, 26, 6, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.beginPath(); g.arc(28, 26, 10, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); break;
    case 'ew': P([10, 40, 50, 40, 50, 46, 10, 46], body(38, 47)); wheels(46, [16, 26, 40, 46], 2.6); P([12, 40, 12, 32, 24, 32, 26, 40], body(31, 41)); P([28, 40, 28, 30, 50, 30, 50, 40], body(29, 41));
      g.strokeStyle = ink; g.lineWidth = 1.8; g.beginPath(); g.moveTo(39, 30); g.lineTo(39, 16); g.stroke(); g.fillStyle = '#d0d6da'; g.beginPath(); g.ellipse(39, 15, 8, 3, -0.2, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = '#c38bff'; g.lineWidth = 2; for (const r of [6, 11, 16]) { g.beginPath(); g.arc(39, 15, r, -Math.PI * 0.85, -Math.PI * 0.15); g.stroke(); } break;
    case 'launcher': P([6, 42, 56, 42, 56, 46, 6, 46], body(40, 47)); wheels(46, [11, 20, 34, 43, 51], 2.6); P([6, 42, 6, 34, 16, 34, 18, 42], body(33, 43));
      g.save(); g.translate(20, 40); g.rotate(-0.45); P([0, -3, 34, -3, 40, 0, 34, 3, 0, 3], '#e8ecef'); g.fillStyle = '#ff5a3c'; g.fillRect(34, -2.5, 3, 5); P([0, -3, -4, -7, 4, -3], '#9aa3a9'); g.restore(); break;
    case 'ship': P([6, 38, 58, 38, 52, 47, 12, 47], body(36, 48)); P([20, 38, 22, 28, 40, 28, 42, 38], body(26, 39)); P([28, 28, 29, 20, 34, 20, 35, 28], body(18, 29)); g.strokeStyle = ink; g.beginPath(); g.moveTo(31.5, 20); g.lineTo(31.5, 12); g.stroke();
      g.strokeStyle = '#7fc8ff'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(4, 48); g.quadraticCurveTo(14, 45, 24, 48); g.quadraticCurveTo(34, 51, 44, 48); g.quadraticCurveTo(52, 45, 60, 48); g.stroke(); break;
    case 'fighter': P([32, 6, 35, 18, 54, 30, 54, 33, 35, 29, 34, 38, 41, 43, 23, 43, 30, 38, 29, 29, 10, 33, 10, 30, 29, 18], body(6, 44)); g.fillStyle = '#7fd0ff'; g.beginPath(); g.ellipse(32, 15, 1.6, 4, 0, 0, 7); g.fill(); break;
    case 'bomber': P([32, 12, 60, 34, 56, 37, 42, 33, 36, 38, 32, 34, 28, 38, 22, 33, 8, 37, 4, 34], body(12, 38)); g.fillStyle = '#4d575e'; g.beginPath(); g.ellipse(32, 20, 2, 4, 0, 0, 7); g.fill(); break;
    case 'uav': P([31, 12, 33, 12, 34, 22, 56, 26, 56, 29, 34, 28, 34, 38, 40, 41, 24, 41, 30, 38, 30, 28, 8, 29, 8, 26, 30, 22], body(12, 42)); g.fillStyle = '#ff5a3c'; g.fillRect(14, 29, 3, 3); g.fillRect(47, 29, 3, 3); break;
    case 'recon': P([30, 14, 34, 14, 35, 24, 52, 27, 52, 29, 35, 29, 34, 38, 30, 38, 29, 29, 12, 29, 12, 27, 29, 24], body(14, 38)); g.fillStyle = '#1a2026'; g.beginPath(); g.arc(32, 31, 4, 0, 7); g.fill(); g.fillStyle = '#7fe3ff'; g.beginPath(); g.arc(32, 31, 2, 0, 7); g.fill(); break;
    case 'loiter': P([32, 8, 35, 14, 35, 40, 29, 40, 29, 14], body(8, 40)); P([29, 22, 14, 32, 14, 35, 29, 30], body(22, 35)); P([35, 22, 50, 32, 50, 35, 35, 30], body(22, 35)); P([29, 36, 22, 42, 42, 42, 35, 36], body(36, 42)); g.fillStyle = '#ff5a3c'; g.beginPath(); g.arc(32, 11, 2, 0, 7); g.fill(); break;
    case 'awacs': P([32, 14, 35, 22, 56, 30, 56, 33, 35, 31, 34, 42, 40, 45, 24, 45, 30, 42, 29, 31, 8, 33, 8, 30, 29, 22], body(14, 45)); g.fillStyle = '#e8ecef'; g.beginPath(); g.ellipse(32, 26, 12, 4, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = color; g.fillRect(22, 25, 20, 2); break;
    case 'sf': g.fillStyle = '#2d3a2e'; g.beginPath(); g.moveTo(20, 46); g.quadraticCurveTo(20, 30, 32, 29); g.quadraticCurveTo(44, 30, 44, 46); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.arc(32, 23, 7, 0, 7); g.fillStyle = '#c9b79a'; g.fill(); g.stroke(); g.fillStyle = '#1a1f1a'; g.fillRect(25, 21, 14, 3.5); g.fillStyle = '#7dff9a'; g.fillRect(27, 21.6, 3, 2); g.fillRect(34, 21.6, 3, 2); g.fillStyle = '#2d3a2e'; g.beginPath(); g.ellipse(32, 18, 9, 4, 0, Math.PI, 0); g.fill(); g.stroke(); g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.moveTo(22, 42); g.lineTo(46, 28); g.stroke(); break;
    case 'missile': g.save(); g.translate(32, 30); g.rotate(-0.7); P([-3, -20, 0, -26, 3, -20, 3, 14, 8, 20, -8, 20, -3, 14], '#eef1f3'); g.restore(); break;
  }
  // glossy rim highlight on the topper
  g.globalCompositeOperation = 'source-atop'; const hl = g.createLinearGradient(0, 0, 64, 0); hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.3, 'rgba(255,255,255,0.12)'); hl.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.fillRect(0, 0, 64, 60); g.globalCompositeOperation = 'source-over';
  cache.set(key, c); return c;
}

// ---- v3 helpers: outlined, high-res chess pieces and top-down flying sprites ----
const oc = new Map<string, HTMLCanvasElement>();
/** Chess piece with a crisp dark outline + nation-colored insignia, rendered at device pixels. */
export function bigPiece(t: UKey | 'missile', color: string, px: number): HTMLCanvasElement {
  const key = 'B' + t + color + px; let c = oc.get(key); if (c) return c;
  const pad = Math.ceil(px * 0.06); const src = piece(t, color, px);
  const sil = document.createElement('canvas'); sil.width = src.width; sil.height = src.height; const sg = sil.getContext('2d')!; sg.drawImage(src, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#05080b'; sg.fillRect(0, 0, sil.width, sil.height);
  c = document.createElement('canvas'); c.width = src.width + pad * 2; c.height = src.height + pad * 2; const g = c.getContext('2d')!;
  const o = Math.max(1.5, px / 40); for (let a = 0; a < 8; a++) g.drawImage(sil, pad + Math.cos(a * Math.PI / 4) * o, pad + Math.sin(a * Math.PI / 4) * o);
  g.drawImage(src, pad, pad);
  // insignia on the pedestal front
  const k = px / 64; g.fillStyle = color; g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, k * 1.2); g.beginPath(); g.arc(pad + 32 * k, pad + 67 * k, 4.2 * k, 0, 7); g.fill(); g.stroke();
  oc.set(key, c); return c;
}
/** Top-down sprite pointing +x, for animated flight. */
export function airSprite(kind: string, color: string, px: number): HTMLCanvasElement {
  const key = 'A' + kind + color + px; let c = oc.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d')!; g.translate(px / 2, px / 2); g.scale(px / 40, px / 40); g.lineJoin = 'round';
  const metal = (() => { const q = g.createLinearGradient(0, -14, 0, 14); q.addColorStop(0, '#f4f7f9'); q.addColorStop(0.5, '#b6c0c7'); q.addColorStop(1, '#5d6870'); return q; })();
  const P = (pts: number[], f: string | CanvasGradient) => { g.fillStyle = f; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); g.strokeStyle = '#06090c'; g.lineWidth = 1.6; g.stroke(); };
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 3; g.shadowOffsetY = 3;
  switch (kind) {
    case 'fighter': P([18, 0, 6, -3, 0, -15, -4, -15, -3, -4, -12, -4, -16, -9, -18, -9, -16, 0, -18, 9, -16, 9, -12, 4, -3, 4, -4, 15, 0, 15, 6, 3], metal); g.shadowColor = 'transparent'; P([3, -4, -3, -4, -3, 4, 3, 4], color); g.fillStyle = '#7fd8ff'; g.beginPath(); g.ellipse(10, 0, 3.5, 1.6, 0, 0, 7); g.fill(); break;
    case 'bomber': P([16, 0, 8, -2, -10, -18, -14, -18, -8, -6, -12, -4, -16, 0, -12, 4, -8, 6, -14, 18, -10, 18, 8, 2], metal); g.shadowColor = 'transparent'; P([2, -3, -8, -3, -8, 3, 2, 3], color); break;
    case 'uav': case 'recon': P([14, 0, 10, -1.5, 2, -1.5, 0, -17, -3, -17, -3, -1.5, -11, -1.5, -14, -6, -15, -6, -14, 0, -15, 6, -14, 6, -11, 1.5, -3, 1.5, -3, 17, 0, 17, 2, 1.5, 10, 1.5], metal); g.shadowColor = 'transparent'; g.fillStyle = color; g.fillRect(-4, -2, 8, 4); if (kind === 'recon') { g.fillStyle = '#7fe3ff'; g.beginPath(); g.arc(9, 0, 2, 0, 7); g.fill(); } break;
    case 'loiter': P([15, 0, 9, -2, -12, -2, -14, 0, -12, 2, 9, 2], metal); P([2, -2, -6, -13, -9, -13, -4, -2], metal); P([2, 2, -6, 13, -9, 13, -4, 2], metal); g.shadowColor = 'transparent'; g.fillStyle = '#ff5a3c'; g.beginPath(); g.arc(13, 0, 1.8, 0, 7); g.fill(); break;
    case 'missile': P([18, 0, 13, -2.4, -12, -2.4, -16, -6, -16, 6, -12, 2.4, 13, 2.4], '#f2f4f6'); g.shadowColor = 'transparent'; g.fillStyle = '#ff5a3c'; g.fillRect(10, -2.4, 3, 4.8); g.fillStyle = color; g.fillRect(-6, -2.4, 4, 4.8); break;
    case 'awacs': P([16, 0, 10, -2.5, 2, -2.5, -2, -18, -6, -18, -4, -2.5, -13, -2.5, -16, -8, -18, -8, -17, 0, -18, 8, -16, 8, -13, 2.5, -4, 2.5, -6, 18, -2, 18, 2, 2.5, 10, 2.5], metal); g.shadowColor = 'transparent'; g.fillStyle = '#e8ecef'; g.strokeStyle = '#06090c'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(-3, 0, 7, 7, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = color; g.fillRect(-10, -1.2, 14, 2.4); break;
    case 'ballistic': P([18, 0, 12, -3.5, -14, -3.5, -17, -8, -17, 8, -14, 3.5, 12, 3.5], '#e8eaec'); g.shadowColor = 'transparent'; g.fillStyle = '#20262b'; g.fillRect(12, -3.5, 2, 7); g.fillStyle = color; g.fillRect(-4, -3.5, 5, 7); break;
  }
  oc.set(key, c); return c;
}
