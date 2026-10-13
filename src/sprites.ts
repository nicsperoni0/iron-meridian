// v4 original art: map textures, top-down vehicle sprites with shadows, procedural flags, map pins, advisor avatar.
import type { UKey } from './sim';
const C = new Map<string, HTMLCanvasElement>();
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function rnd(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- terrain & ocean textures ----------
export function landTexture(): HTMLCanvasElement { let c = C.get('land'); if (c) return c; c = mk(512, 512); const g = c.getContext('2d')!; const R = rnd(7);
  g.fillStyle = '#5d8a3c'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) { const x = R() * 512, y = R() * 512, r = 10 + R() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); const light = R() < 0.45; gr.addColorStop(0, light ? 'rgba(150,180,90,0.35)' : 'rgba(40,80,35,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  for (let i = 0; i < 9000; i++) { const x = R() * 512, y = R() * 512; const t = R(); g.fillStyle = t < 0.55 ? `rgba(30,${70 + R() * 30 | 0},28,${0.5 + R() * 0.4})` : t < 0.8 ? `rgba(${110 + R() * 40 | 0},${150 + R() * 30 | 0},70,0.5)` : 'rgba(20,45,20,0.6)'; const r = 0.8 + R() * 2.2; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  return wrapSeamless(c, 'land'); }
export function oceanTexture(): HTMLCanvasElement { let c = C.get('ocean'); if (c) return c; c = mk(512, 512); const g = c.getContext('2d')!; const R = rnd(11);
  g.fillStyle = '#2a5f8f'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 120; i++) { const x = R() * 512, y = R() * 512, r = 30 + R() * 90; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, R() < 0.5 ? 'rgba(60,120,170,0.25)' : 'rgba(15,50,90,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(180,215,240,0.10)'; g.lineWidth = 1; for (let i = 0; i < 900; i++) { const x = R() * 512, y = R() * 512, l = 3 + R() * 6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 1.5, x + l, y); g.stroke(); }
  return wrapSeamless(c, 'ocean'); }
function wrapSeamless(src: HTMLCanvasElement, key: string) { // mirror-blend edges so the pattern tiles softly
  const c = mk(src.width, src.height); const g = c.getContext('2d')!; g.drawImage(src, 0, 0); g.globalAlpha = 0.5; g.save(); g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); g.restore(); g.save(); g.translate(0, src.height); g.scale(1, -1); g.drawImage(src, 0, 0); g.restore(); C.set(key, c); return c; }
export function cityTexture(level: number, px: number): HTMLCanvasElement { const key = 'city' + level + px; let c = C.get(key); if (c) return c; c = mk(px, px); const g = c.getContext('2d')!; const R = rnd(level * 97 + 3); const n = 30 + level * 28;
  for (let i = 0; i < n; i++) { const a = R() * 6.283, d = Math.pow(R(), 0.7) * px * 0.46; const x = px / 2 + Math.cos(a) * d, y = px / 2 + Math.sin(a) * d * 0.8; const w = 2 + R() * (2 + level * 0.6), h = 2 + R() * 3; const sh = 150 + R() * 70 | 0;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 1, y + 1, w, h); g.fillStyle = `rgb(${sh},${sh},${sh - 10})`; g.fillRect(x, y, w, h); g.fillStyle = `rgba(255,255,255,0.35)`; g.fillRect(x, y, w, 0.8); }
  g.strokeStyle = 'rgba(60,60,55,0.55)'; g.lineWidth = 0.8; for (let i = 0; i < 6 + level * 2; i++) { const a = R() * 3.14; g.beginPath(); g.moveTo(px / 2 - Math.cos(a) * px * 0.45, px / 2 - Math.sin(a) * px * 0.35); g.lineTo(px / 2 + Math.cos(a) * px * 0.45, px / 2 + Math.sin(a) * px * 0.35); g.stroke(); }
  C.set(key, c); return c; }
export function peak(px: number): HTMLCanvasElement { const key = 'peak' + px; let c = C.get(key); if (c) return c; c = mk(px, px); const g = c.getContext('2d')!; g.scale(px / 20, px / 20);
  g.fillStyle = '#6f7368'; g.beginPath(); g.moveTo(1, 17); g.lineTo(10, 3); g.lineTo(19, 17); g.closePath(); g.fill(); g.fillStyle = '#9a9e93'; g.beginPath(); g.moveTo(10, 3); g.lineTo(19, 17); g.lineTo(11, 17); g.closePath(); g.fill(); g.fillStyle = '#e8ece4'; g.beginPath(); g.moveTo(10, 3); g.lineTo(12.5, 7); g.lineTo(7.5, 7); g.closePath(); g.fill(); C.set(key, c); return c; }

// ---------- procedural original flags ----------
const PAL = ['#c8102e', '#ffffff', '#003da5', '#009739', '#fcd116', '#000000', '#ef7d00', '#5b2c83', '#00a3dd', '#7b1f2b'];
export function flag(n: number, px: number): HTMLCanvasElement { const key = 'flag' + n + px; let c = C.get(key); if (c) return c; const w = px, h = Math.round(px * 0.66); c = mk(w, h); const g = c.getContext('2d')!; const R = rnd(n * 2654435761 + 1);
  const cols = [PAL[Math.floor(R() * PAL.length)], PAL[Math.floor(R() * PAL.length)], PAL[Math.floor(R() * PAL.length)]]; if (cols[0] === cols[1]) cols[1] = cols[1] === '#ffffff' ? '#c8102e' : '#ffffff'; if (cols[2] === cols[1]) cols[2] = cols[0];
  const lay = Math.floor(R() * 5);
  if (lay === 0) cols.forEach((cl, i) => { g.fillStyle = cl; g.fillRect(0, i * h / 3, w, h / 3 + 1); });
  else if (lay === 1) cols.forEach((cl, i) => { g.fillStyle = cl; g.fillRect(i * w / 3, 0, w / 3 + 1, h); });
  else if (lay === 2) { g.fillStyle = cols[0]; g.fillRect(0, 0, w, h / 2); g.fillStyle = cols[1]; g.fillRect(0, h / 2, w, h / 2); }
  else if (lay === 3) { g.fillStyle = cols[0]; g.fillRect(0, 0, w, h); g.fillStyle = cols[1]; g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.45, h / 2); g.lineTo(0, h); g.fill(); }
  else { g.fillStyle = cols[0]; g.fillRect(0, 0, w, h); g.fillStyle = cols[1]; g.fillRect(w * 0.28, 0, w * 0.14, h); g.fillRect(0, h * 0.43, w, h * 0.14); }
  if (R() < 0.5) { g.fillStyle = cols[2] === cols[0] ? '#fcd116' : cols[2]; star(g, w * 0.5, h * 0.5, h * 0.22, h * 0.09); }
  const sh = g.createLinearGradient(0, 0, w, h); sh.addColorStop(0, 'rgba(255,255,255,0.25)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.2)'); g.fillStyle = sh; g.fillRect(0, 0, w, h);
  C.set(key, c); return c; }
function star(g: CanvasRenderingContext2D, x: number, y: number, R: number, r: number) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }

// ---------- small white unit-type glyphs for banner boxes ----------
export function glyph(g: CanvasRenderingContext2D, t: string, x: number, y: number, s: number) { g.save(); g.translate(x, y); g.scale(s / 20, s / 20); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.lineCap = 'round';
  const P = (pts: number[]) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
  switch (t) {
    case 'tank': case 'ifv': P([-9, 2, 9, 2, 7, 6, -7, 6]); P([-5, 2, -4, -3, 4, -3, 5, 2]); g.fillRect(4, -2, 7, 1.8); break;
    case 'inf': case 'sf': g.beginPath(); g.arc(0, -4, 3.5, 0, 7); g.fill(); P([-6, 8, -5, 0, 5, 0, 6, 8]); break;
    case 'art': case 'launcher': g.beginPath(); g.arc(-4, 5, 3, 0, 7); g.fill(); g.lineWidth = 3; g.beginPath(); g.moveTo(-4, 4); g.lineTo(9, -6); g.stroke(); break;
    case 'sam': case 'cuas': for (const dx of [-5, 0, 5]) P([dx, -8, dx + 2, -4, dx + 2, 6, dx - 2, 6, dx - 2, -4]); break;
    case 'ew': case 'awacs': g.lineWidth = 2; for (const r of [3, 6, 9]) { g.beginPath(); g.arc(0, 4, r, -2.6, -0.5); g.stroke(); } g.beginPath(); g.arc(0, 4, 1.8, 0, 7); g.fill(); break;
    case 'ship': P([-9, 1, 9, 1, 6, 6, -6, 6]); g.fillRect(-3, -4, 6, 5); break;
    case 'uav': case 'recon': case 'loiter': P([0, -8, 2, -2, 9, 0, 9, 2, 2, 2, 1, 7, -1, 7, -2, 2, -9, 2, -9, 0, -2, -2]); break;
    default: P([9, 0, 2, -1.5, -2, -9, -4, -9, -3, -1.5, -8, -1.5, -10, -4, -11, -4, -10, 0, -11, 4, -10, 4, -8, 1.5, -3, 1.5, -4, 9, -2, 9, 2, 1.5]); // plane
  } g.restore(); }

// ---------- detailed top-down vehicle sprites (pointing +x), with soft drop shadow ----------
export function vehicle(t: UKey | 'missile' | 'ballistic', px: number, hue = 0): HTMLCanvasElement { const key = 'veh' + t + px + hue; let c = C.get(key); if (c) return c;
  c = mk(px, px); const g = c.getContext('2d')!; g.translate(px / 2, px / 2); g.scale(px / 48, px / 48); g.lineJoin = 'round';
  const camo = (a: string, b: string) => { const q = g.createLinearGradient(0, -12, 0, 12); q.addColorStop(0, a); q.addColorStop(1, b); return q; };
  const P = (pts: number[], f: string | CanvasGradient, st = 'rgba(10,14,10,0.85)') => { g.fillStyle = f; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); g.strokeStyle = st; g.lineWidth = 1.2; g.stroke(); };
  const shadow = (on: boolean) => { g.shadowColor = on ? 'rgba(0,0,0,0.55)' : 'transparent'; g.shadowBlur = on ? 4 : 0; g.shadowOffsetX = on ? 3 : 0; g.shadowOffsetY = on ? 4 : 0; };
  const green = camo('#8a9a5b', '#4e5a30'), sand = camo('#c9b98a', '#8a7a52'), grey = camo('#e6eaee', '#8d979f'), navy = camo('#9aa6b1', '#56636e');
  shadow(true);
  switch (t) {
    case 'tank': P([-16, -9, 15, -9, 17, -6, 17, 6, 15, 9, -16, 9, -18, 6, -18, -6], green); shadow(false); g.fillStyle = '#2b301f'; g.fillRect(-17, -10.5, 33, 3); g.fillRect(-17, 7.5, 33, 3); P([-8, -6, 5, -6, 7, -3, 7, 3, 5, 6, -8, 6, -10, 3, -10, -3], camo('#9aab68', '#5d6a3a')); g.fillStyle = '#3d4528'; g.fillRect(6, -1.4, 18, 2.8); g.fillStyle = '#c9d29a'; g.beginPath(); g.arc(-3, -2, 2, 0, 7); g.fill(); break;
    case 'ifv': P([-15, -8, 14, -8, 17, -4, 17, 4, 14, 8, -15, 8], camo('#93a066', '#58653a')); shadow(false); for (const x of [-11, -4, 3, 10]) { g.fillStyle = '#262a1c'; g.fillRect(x - 2.5, -10, 5, 2.5); g.fillRect(x - 2.5, 7.5, 5, 2.5); } P([-2, -4, 6, -4, 6, 4, -2, 4], '#6f7b48'); g.fillStyle = '#333a24'; g.fillRect(6, -0.8, 12, 1.6); break;
    case 'art': case 'launcher': P([-18, -7, 6, -7, 6, 7, -18, 7], sand); P([6, -6, 16, -6, 18, -3, 18, 3, 16, 6, 6, 6], camo('#b8a878', '#7a6c48')); shadow(false); g.fillStyle = '#7fb8e0'; g.fillRect(13, -4, 3, 8); for (const x of [-14, -6, 10]) { g.fillStyle = '#222'; g.fillRect(x - 2.5, -9, 5, 2.5); g.fillRect(x - 2.5, 6.5, 5, 2.5); }
      if (t === 'art') { g.fillStyle = '#4a4430'; g.fillRect(-16, -1.3, 26, 2.6); } else { P([-17, -4, 4, -4, 8, 0, 4, 4, -17, 4], '#eef1f2'); g.fillStyle = '#d33'; g.fillRect(2, -4, 3, 8); } break;
    case 'sam': case 'cuas': case 'ew': P([-17, -7, 8, -7, 8, 7, -17, 7], camo('#9aa36a', '#5f673d')); P([8, -6, 17, -6, 18, 0, 17, 6, 8, 6], camo('#a7b077', '#6a7346')); shadow(false); g.fillStyle = '#7fb8e0'; g.fillRect(13, -4, 3, 8); for (const x of [-13, -5, 12]) { g.fillStyle = '#222'; g.fillRect(x - 2.5, -9, 5, 2.5); g.fillRect(x - 2.5, 6.5, 5, 2.5); }
      if (t === 'sam') { for (const y of [-4.5, -1.5, 1.5, 4.5]) P([-15, y - 1.2, 4, y - 1.2, 6, y, 4, y + 1.2, -15, y + 1.2], '#e8ebed'); } else if (t === 'ew') { g.fillStyle = '#ddd'; g.beginPath(); g.ellipse(-5, 0, 7, 5, 0, 0, 7); g.fill(); g.strokeStyle = '#555'; g.stroke(); g.strokeStyle = '#b48cff'; g.lineWidth = 1.5; for (const r of [9, 12]) { g.beginPath(); g.arc(-5, 0, r, -0.8, 0.8); g.stroke(); } } else { g.fillStyle = '#4c5232'; g.beginPath(); g.arc(-5, 0, 5, 0, 7); g.fill(); g.fillStyle = '#222'; g.fillRect(-2, -2.5, 12, 1.6); g.fillRect(-2, 0.9, 12, 1.6); } break;
    case 'inf': case 'sf': shadow(false); for (const [x, y] of [[-8, -6], [0, -8], [8, -5], [-6, 4], [3, 3], [10, 6], [-1, 11]]) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x + 2, y + 3, 3.4, 2, 0, 0, 7); g.fill(); g.fillStyle = t === 'sf' ? '#3b4433' : '#6b7a45'; g.beginPath(); g.ellipse(x, y, 3.4, 2.6, 0, 0, 7); g.fill(); g.strokeStyle = '#1b2014'; g.lineWidth = 0.8; g.stroke(); g.fillStyle = t === 'sf' ? '#22281d' : '#4f5a32'; g.beginPath(); g.arc(x + 0.5, y, 1.8, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 1, y + 1); g.lineTo(x + 5, y - 1); g.stroke(); } break;
    case 'ship': P([-22, -5, 14, -5, 23, 0, 14, 5, -22, 5], navy); shadow(false); P([-12, -3, 2, -3, 2, 3, -12, 3], '#c8d0d6'); P([-8, -2, -2, -2, -2, 2, -8, 2], '#7b8790'); g.fillStyle = '#333'; g.beginPath(); g.arc(9, 0, 2, 0, 7); g.fill(); g.fillRect(9, -0.6, 7, 1.2); g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-24, -6); g.lineTo(-30, -9); g.moveTo(-24, 6); g.lineTo(-30, 9); g.stroke(); break;
    case 'fighter': P([20, 0, 9, -3, 1, -17, -4, -17, -3, -4, -13, -4, -17, -10, -20, -10, -18, 0, -20, 10, -17, 10, -13, 4, -3, 4, -4, 17, 1, 17, 9, 3], grey); shadow(false); g.fillStyle = '#5ab0e0'; g.beginPath(); g.ellipse(11, 0, 4, 1.8, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(60,70,80,0.5)'; g.fillRect(-10, -1, 14, 2); break;
    case 'bomber': P([16, 0, 8, -3, -8, -22, -14, -22, -8, -6, -13, -4, -17, 0, -13, 4, -8, 6, -14, 22, -8, 22, 8, 3], camo('#4b5560', '#252c33')); shadow(false); g.fillStyle = '#7a8a99'; g.beginPath(); g.ellipse(9, 0, 3, 1.4, 0, 0, 7); g.fill(); break;
    case 'heli' as any: break;
    case 'uav': case 'recon': case 'loiter': if (t === 'loiter') { P([16, 0, 10, -2, -12, -2, -14, 0, -12, 2, 10, 2], grey); P([2, -2, -6, -12, -9, -12, -4, -2], grey); P([2, 2, -6, 12, -9, 12, -4, 2], grey); } else P([14, 0, 10, -1.6, 2, -1.6, 0, -20, -3, -20, -3, -1.6, -11, -1.6, -14, -7, -16, -7, -14, 0, -16, 7, -14, 7, -11, 1.6, -3, 1.6, -3, 20, 0, 20, 2, 1.6, 10, 1.6], camo('#c9ced3', '#7e878f')); shadow(false); if (t === 'recon') { g.fillStyle = '#5ab0e0'; g.beginPath(); g.arc(9, 0, 2, 0, 7); g.fill(); } break;
    case 'awacs': P([18, 0, 12, -2.5, 2, -2.5, -2, -21, -6, -21, -4, -2.5, -14, -2.5, -17, -8, -19, -8, -18, 0, -19, 8, -17, 8, -14, 2.5, -4, 2.5, -6, 21, -2, 21, 2, 2.5, 12, 2.5], grey); shadow(false); g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.beginPath(); g.ellipse(-4, 0, 7.5, 7.5, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#2c3e50'; g.fillRect(-11, -1, 14, 2); break;
    case 'missile': P([20, 0, 14, -2.6, -14, -2.6, -18, -7, -18, 7, -14, 2.6, 14, 2.6], '#f0f2f3'); shadow(false); g.fillStyle = '#d33'; g.fillRect(11, -2.6, 3, 5.2); break;
    case 'ballistic': P([20, 0, 13, -3.6, -16, -3.6, -19, -9, -19, 9, -16, 3.6, 13, 3.6], '#e6e8ea'); shadow(false); g.fillStyle = '#222'; g.fillRect(13, -3.6, 2.5, 7.2); break;
  }
  C.set(key, c); return c; }
export function rotor(g: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) { g.save(); g.translate(x, y); g.rotate(t * 30); g.fillStyle = 'rgba(30,30,30,0.18)'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.strokeStyle = 'rgba(20,20,20,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.moveTo(0, -r); g.lineTo(0, r); g.stroke(); g.restore(); }

// ---------- map pin for city buildings ----------
export function pin(kind: string, px: number): HTMLCanvasElement { const key = 'pin' + kind + px; let c = C.get(key); if (c) return c; c = mk(px, Math.round(px * 1.3)); const g = c.getContext('2d')!; g.scale(px / 30, px / 30);
  g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 3; g.shadowOffsetY = 2; const q = g.createRadialGradient(13, 11, 2, 15, 14, 15); q.addColorStop(0, '#d9f3a8'); q.addColorStop(1, '#78a83e'); g.fillStyle = q; g.beginPath(); g.arc(15, 14, 12, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(15, 38); g.closePath(); g.fill(); g.shadowColor = 'transparent'; g.strokeStyle = 'rgba(40,70,20,0.8)'; g.lineWidth = 1.2; g.stroke();
  g.translate(15, 14); const P = (pts: number[], f: string) => { g.fillStyle = f; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); g.strokeStyle = '#2f3d1f'; g.lineWidth = 0.8; g.stroke(); };
  switch (kind) {
    case 'factory': P([-8, 6, -8, -1, -4, 1, -4, -1, 0, 1, 0, -1, 4, 1, 4, -7, 7, -7, 7, 6], '#8c9aa3'); break;
    case 'barracks': P([-8, 6, -8, -1, 0, -6, 8, -1, 8, 6], '#a3906a'); g.fillStyle = '#3d4b2a'; g.fillRect(-2, 1, 4, 5); break;
    case 'airfield': P([0, -8, 2, -2, 8, 1, 8, 3, 2, 2, 1, 6, 3, 8, -3, 8, -1, 6, -2, 2, -8, 3, -8, 1, -2, -2], '#e8ecef'); break;
    case 'port': g.strokeStyle = '#2f4f6f'; g.lineWidth = 2; g.beginPath(); g.arc(0, -5, 2, 0, 7); g.moveTo(0, -3); g.lineTo(0, 7); g.moveTo(-5, -1); g.lineTo(5, -1); g.moveTo(-6, 2); g.quadraticCurveTo(-5, 7, 0, 7); g.quadraticCurveTo(5, 7, 6, 2); g.stroke(); break;
    case 'missile': P([0, -9, 2.5, -5, 2.5, 4, 5, 7, -5, 7, -2.5, 4, -2.5, -5], '#eef0f2'); g.fillStyle = '#d33'; g.fillRect(-2.5, -3, 5, 2); break;
    case 'samsite': for (const x of [-5, 0, 5]) P([x, -8, x + 1.8, -4, x + 1.8, 6, x - 1.8, 6, x - 1.8, -4], '#eef0f2'); break;
    case 'ewstation': g.strokeStyle = '#6b3fb5'; g.lineWidth = 1.6; for (const r of [3, 6, 9]) { g.beginPath(); g.arc(0, 3, r, -2.6, -0.5); g.stroke(); } g.fillStyle = '#6b3fb5'; g.fillRect(-1, 3, 2, 5); break;
    case 'defense': P([-8, 6, -6, -2, 0, -5, 6, -2, 8, 6], '#8a8f78'); g.fillStyle = '#222'; g.fillRect(-4, 0, 8, 1.6); break;
    default: P([-7, 6, -7, -4, 7, -4, 7, 6], '#c9d0d6');
  }
  C.set(key, c); return c; }

// ---------- original advisor avatar ----------
export function avatar(px: number): string { const c = mk(px, px); const g = c.getContext('2d')!; g.scale(px / 64, px / 64);
  const bg = g.createLinearGradient(0, 0, 0, 64); bg.addColorStop(0, '#4a90b8'); bg.addColorStop(1, '#1e4a66'); g.fillStyle = bg; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#2f3d4a'; g.beginPath(); g.moveTo(8, 64); g.quadraticCurveTo(12, 44, 32, 42); g.quadraticCurveTo(52, 44, 56, 64); g.fill(); g.fillStyle = '#c9a24a'; g.fillRect(18, 50, 6, 3); g.fillRect(40, 50, 6, 3);
  g.fillStyle = '#e0b48f'; g.fillRect(27, 34, 10, 9); g.beginPath(); g.ellipse(32, 28, 11, 13, 0, 0, 7); g.fill();
  g.fillStyle = '#2a3440'; g.beginPath(); g.ellipse(32, 17, 15, 7, 0, Math.PI, 0); g.fill(); g.fillRect(16, 16, 32, 5); g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(32, 14, 2.5, 0, 7); g.fill();
  g.fillStyle = '#3a2a20'; g.fillRect(25, 26, 5, 1.6); g.fillRect(34, 26, 5, 1.6); g.fillStyle = '#222'; g.beginPath(); g.arc(27.5, 29, 1.3, 0, 7); g.arc(36.5, 29, 1.3, 0, 7); g.fill(); g.strokeStyle = '#9a6a50'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(29, 36); g.quadraticCurveTo(32, 37.5, 35, 36); g.stroke();
  return c.toDataURL(); }
