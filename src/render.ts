import { Sim, UNITS, UKey, Army, csum, EW_R, AIR_DEF_R } from './sim';
import { World } from './world';
import { piece } from './pieces';
import { icon } from './icons';
const BICON: Record<string, string> = { base: 'base', airfield: 'airfield', missile: 'missile', ewstation: 'ew', samsite: 'sam', defense: 'bunker' };
export const PLAYER_COLOR = 'hsl(200,85%,50%)';
export const PLAYER_FILL = 'hsl(200,45%,30%)';
export class Renderer {
  cv: HTMLCanvasElement; g: CanvasRenderingContext2D; w!: World; geo: Path2D[] = []; geoBox: number[][] = []; cells: Path2D[] = [];
  cam = { x: 0, y: 0, z: 1 }; dpr = Math.min(2, window.devicePixelRatio || 1); sel = -1; selArmy = -1; mode: 'none' | 'move' | 'strike' = 'none'; armyPos = new Map<number, [number, number]>();
  constructor(cv: HTMLCanvasElement) { this.cv = cv; this.g = cv.getContext('2d')!; this.resize(); }
  setWorld(w: World) { this.w = w;
    this.geo = w.geoPolys.map(ps => { const P = new Path2D(); for (const r of ps) { P.moveTo(r[0], r[1]); for (let i = 2; i < r.length; i += 2) P.lineTo(r[i], r[i + 1]); P.closePath(); } return P; });
    this.geoBox = w.geoPolys.map(ps => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const r of ps) for (let i = 0; i < r.length; i += 2) { a = Math.min(a, r[i]); c = Math.max(c, r[i]); b = Math.min(b, r[i + 1]); d = Math.max(d, r[i + 1]); } return [a, b, c, d]; });
    this.cells = w.regions.map(r => { const P = new Path2D(); const c = r.cell; if (c.length) { P.moveTo(c[0], c[1]); for (let i = 2; i < c.length; i += 2) P.lineTo(c[i], c[i + 1]); P.closePath(); } return P; }); }
  resize() { this.cv.width = innerWidth * this.dpr; this.cv.height = innerHeight * this.dpr; this.cv.style.width = innerWidth + 'px'; this.cv.style.height = innerHeight + 'px'; }
  color(sim: Sim, o: number) { return o === sim.s.player ? PLAYER_COLOR : this.w.nations[o].color; }
  focus(r: number, z = 3) { const R = this.w.regions[r]; this.cam.z = z; this.cam.x = R.x - innerWidth / 2 / z; this.cam.y = R.y - innerHeight / 2.8 / z; }
  toWorld(sx: number, sy: number) { return [sx / this.cam.z + this.cam.x, sy / this.cam.z + this.cam.y]; }
  pickArmy(sx: number, sy: number) { let best = -1, bd = 26; for (const [id, [x, y]] of this.armyPos) { const d = Math.hypot(x - sx, y - sy); if (d < bd) { bd = d; best = id; } } return best; }
  pickRegion(sx: number, sy: number) { const [x, y] = this.toWorld(sx, sy); this.g.setTransform(1, 0, 0, 1, 0, 0);
    for (const [lx, ly, lr] of this.w.lakes) if ((x - lx) ** 2 + (y - ly) ** 2 < lr * lr) return -1;
    let geo = -1; for (let i = this.geo.length - 1; i >= 0; i--) { const b = this.geoBox[i]; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue; if (this.g.isPointInPath(this.geo[i], x, y)) { geo = i; break; } }
    if (geo < 0) { let best = -1, bd = 25; this.w.regions.forEach((r, i) => { const d = Math.hypot(r.x - x, r.y - y); if (d < bd) { bd = d; best = i; } }); return best; }
    let best = -1, bd = 1e9; for (const id of this.w.geoRegions[geo]) { const r = this.w.regions[id]; const d = (r.x - x) ** 2 + (r.y - y) ** 2; if (d < bd) { bd = d; best = id; } } return best; }
  armyXY(sim: Sim, a: Army): [number, number] { const R = this.w.regions[a.r]; if (!a.path.length) return [R.x, R.y]; const Q = this.w.regions[a.path[0]]; const e = sim.edgeBetween(a.r, a.path[0]); const f = e >= 0 ? Math.min(1, a.prog / this.w.edges[e].len) : 0; return [R.x + (Q.x - R.x) * f, R.y + (Q.y - R.y) * f]; }
  draw(sim: Sim) {
    const { g, cam, w } = this; const s = sim.s; const W = innerWidth, H = innerHeight, z = cam.z, D = this.dpr;
    g.setTransform(D, 0, 0, D, 0, 0); const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b1a28'); bg.addColorStop(1, '#061019'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.setTransform(D * z, 0, 0, D * z, -cam.x * z * D, -cam.y * z * D);
    g.strokeStyle = 'rgba(90,150,190,0.07)'; g.lineWidth = 1 / z; g.beginPath(); for (let x = 0; x <= w.w; x += 50) { g.moveTo(x, 0); g.lineTo(x, w.h); } for (let y = 0; y <= w.h; y += 50) { g.moveTo(0, y); g.lineTo(w.w, y); } g.stroke();
    const vx0 = cam.x, vy0 = cam.y, vx1 = cam.x + W / z, vy1 = cam.y + H / z;
    // coast glow
    g.lineWidth = 4 / z; g.strokeStyle = 'rgba(120,190,230,0.10)'; for (let i = 0; i < this.geo.length; i++) { const b = this.geoBox[i]; if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue; g.stroke(this.geo[i]); }
    for (let i = 0; i < this.geo.length; i++) { const b = this.geoBox[i]; if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue;
      g.save(); g.clip(this.geo[i]); for (const id of w.geoRegions[i]) { const o = s.regions[id].o; g.fillStyle = o === s.player ? PLAYER_FILL : this.w.nations[o].color; g.fill(this.cells[id]); }
      g.lineWidth = 0.8 / z; g.strokeStyle = 'rgba(0,0,0,0.35)'; for (const id of w.geoRegions[i]) g.stroke(this.cells[id]);
      if (this.sel >= 0 && w.regions[this.sel].geo === i) { g.fillStyle = 'rgba(255,211,77,0.18)'; g.fill(this.cells[this.sel]); g.lineWidth = 2.5 / z; g.strokeStyle = '#ffd34d'; g.stroke(this.cells[this.sel]); }
      g.restore(); g.lineWidth = 1.2 / z; g.strokeStyle = 'rgba(10,14,18,0.9)'; g.stroke(this.geo[i]); }
    g.fillStyle = '#0a1724'; g.strokeStyle = 'rgba(120,190,230,0.25)'; g.lineWidth = 1 / z; for (const [x, y, r] of w.lakes) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); }
    // EW bubbles & SAM rings
    const t = performance.now();
    for (let i = 0; i < w.regions.length; i++) { const R = s.regions[i], P = w.regions[i]; if (P.x < vx0 - 100 || P.x > vx1 + 100 || P.y < vy0 - 100 || P.y > vy1 + 100) continue;
      if (R.b.ewstation) { g.fillStyle = 'rgba(170,110,255,0.10)'; g.beginPath(); g.arc(P.x, P.y, EW_R, 0, 7); g.fill(); g.setLineDash([4 / z, 4 / z]); g.lineDashOffset = -t / 80 / z; g.strokeStyle = 'rgba(195,139,255,0.6)'; g.lineWidth = 1.2 / z; g.stroke(); g.setLineDash([]); }
      if (R.b.samsite && z > 1.1 && (R.o === s.player || i === this.sel)) { g.strokeStyle = 'rgba(255,90,60,0.35)'; g.lineWidth = 1 / z; g.beginPath(); g.arc(P.x, P.y, AIR_DEF_R, 0, 7); g.stroke(); } }
    for (const a of s.armies) if ((a.c.ew || 0) >= 8) { const [x, y] = this.armyXY(sim, a); if (x < vx0 - 60 || x > vx1 + 60) continue; g.fillStyle = 'rgba(170,110,255,0.06)'; g.beginPath(); g.arc(x, y, EW_R * 0.6, 0, 7); g.fill(); }
    // roads
    w.edges.forEach((e, i) => { const A = w.regions[e.a], B = w.regions[e.b]; if (Math.max(A.x, B.x) < vx0 || Math.min(A.x, B.x) > vx1 || Math.max(A.y, B.y) < vy0 || Math.min(A.y, B.y) > vy1) return; const k = s.roads[i];
      if (k === 2) { g.strokeStyle = 'rgba(20,16,10,0.7)'; g.lineWidth = 3.2 / z; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); g.strokeStyle = '#d8c08a'; g.lineWidth = 1.5 / z; g.stroke(); }
      else if (k === 1) { g.strokeStyle = 'rgba(216,192,138,0.6)'; g.setLineDash([3 / z, 3 / z]); g.lineWidth = 1.1 / z; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); g.setLineDash([]); }
      else if (z > 1) { g.strokeStyle = 'rgba(110,180,230,0.25)'; g.setLineDash([1.5 / z, 4 / z]); g.lineWidth = 1 / z; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); g.setLineDash([]); } });
    // screen-space overlay
    g.setTransform(D, 0, 0, D, 0, 0); const sx = (x: number) => (x - cam.x) * z, sy = (y: number) => (y - cam.y) * z;
    for (let i = 0; i < w.regions.length; i++) { const P = w.regions[i]; const x = sx(P.x), y = sy(P.y); if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue; const R = s.regions[i];
      const rad = Math.max(2.5, Math.min(7, Math.log10(P.pop) - 3.5) * (0.6 + z * 0.25)); g.fillStyle = '#f4ead2'; g.strokeStyle = '#111'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); g.stroke();
      if (P.cap) { g.fillStyle = '#ffd34d'; star(g, x, y, rad + 3, rad * 0.5 + 1); }
      if (z > 1.5 || (z > 0.7 && P.pop > 5e6) || (P.cap && z > 0.9)) { g.font = `700 ${P.cap ? 11 : 10}px system-ui`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(P.n, x, y + rad + 11); g.fillStyle = '#e9eef2'; g.fillText(P.n, x, y + rad + 11); }
      if (z > 1.4) { const ks = Object.keys(R.b); const sm = 15; ks.forEach((k, j) => g.drawImage(icon(BICON[k], (R.b as any)[k], R.o === s.player, Math.round(sm * D)), x - ks.length * sm / 2 + j * sm, y + rad + 14, sm, sm)); if (R.q) { g.fillStyle = '#ffd34d'; g.font = '700 9px system-ui'; g.fillText('⚒' + R.q.left, x, y - rad - 4); } } }
    // armies as chess pieces
    this.armyPos.clear(); const perRegion = new Map<number, number>();
    const list = s.armies.filter(a => { const [x, y] = this.armyXY(sim, a); return x > vx0 - 20 && x < vx1 + 20 && y > vy0 - 20 && y < vy1 + 20; });
    const showAll = z > 1.1 || list.length < 120;
    for (const a of list) { const mine = a.o === s.player; if (!showAll && !mine && csum(a.c) < 60) continue;
      const [wx, wy] = this.armyXY(sim, a); const k = perRegion.get(a.path.length ? -a.id : a.r) || 0; perRegion.set(a.path.length ? -a.id : a.r, k + 1);
      const air = sim.dom(a) === 'air'; if (air && z < 1.8 && !mine) continue; const off = a.path.length ? 0 : (air ? 16 : 0) + k * 6;
      const n = csum(a.c); const size = Math.max(18, Math.min(46, 10 + z * 6)) * (1 + Math.min(0.5, Math.log10(Math.max(1, n)) / 6)) * (air ? 0.7 : 1);
      const x = sx(wx) + off, y = sy(wy) - size * 0.55 - (air ? 8 : 0);
      const types = (Object.keys(a.c) as UKey[]).sort((p, q) => a.c[q]! * UNITS[q].pp - a.c[p]! * UNITS[p].pp);
      const col = this.color(sim, a.o);
      if (z > 2.4 && types.length > 1) { types.slice(1, 3).forEach((tp, j) => { const s2 = size * 0.62; const c = piece(tp, col, Math.round(s2 * D)); g.drawImage(c, x + (j ? 0.55 : -1.2) * s2 * 0.75, y + size * 0.25, s2, s2 * 1.25); }); }
      const c = piece(types[0], col, Math.round(size * D)); g.drawImage(c, x - size / 2, y - size * 0.6, size, size * 1.25);
      if (a.id === this.selArmy) { g.strokeStyle = '#ffd34d'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(x, y + size * 0.55, size * 0.45, size * 0.14, 0, 0, 7); g.stroke(); }
      const label = n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); g.font = '800 10px system-ui'; const tw = g.measureText(label).width + 8;
      g.fillStyle = mine ? '#0e3a5c' : '#5a1e1e'; g.strokeStyle = mine ? '#6cc4ff' : '#ff8a7a'; g.lineWidth = 1.2; g.beginPath(); g.roundRect(x - tw / 2, y + size * 0.58, tw, 13, 6); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(label, x, y + size * 0.58 + 10);
      if (a.path.length) { g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(x + size * 0.35, y - size * 0.45, 3.5, 0, 7); g.fill(); }
      this.armyPos.set(a.id, [x, y]); }
    // selected army route
    const sa = s.armies.find(a => a.id === this.selArmy); if (sa && sa.path.length) { g.strokeStyle = 'rgba(255,211,77,0.85)'; g.setLineDash([6, 4]); g.lineWidth = 2; g.beginPath(); const [x0, y0] = this.armyXY(sim, sa); g.moveTo(sx(x0), sy(y0)); for (const q of sa.path) g.lineTo(sx(w.regions[q].x), sy(w.regions[q].y)); g.stroke(); g.setLineDash([]); }
    // strikes in flight
    for (const k of s.strikes) { const T = w.regions[k.back ? k.home : k.target]; const f = Math.min(1, k.prog / k.dist); const x0 = sx(k.x0), y0 = sy(k.y0), x1 = sx(T.x), y1 = sy(T.y); const lift = Math.hypot(x1 - x0, y1 - y0) * 0.25;
      const bx = (u: number) => (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * (x0 + x1) / 2 + u * u * x1, by = (u: number) => (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * ((y0 + y1) / 2 - lift) + u * u * y1;
      const mine = k.o === s.player; g.strokeStyle = k.back ? 'rgba(150,200,255,0.25)' : mine ? 'rgba(108,196,255,0.5)' : 'rgba(255,110,90,0.55)'; g.setLineDash([4, 4]); g.lineWidth = 1.5; g.beginPath(); for (let u = 0; u <= f; u += 0.04) u === 0 ? g.moveTo(bx(u), by(u)) : g.lineTo(bx(u), by(u)); g.stroke(); g.setLineDash([]);
      const kind: any = Object.keys(k.m).length ? 'missile' : (Object.keys(k.c) as UKey[]).sort((p, q) => k.c[q]! - k.c[p]!)[0]; const pc = piece(kind, this.color(sim, k.o), Math.round(30 * D));
      const px = bx(f), py = by(f); g.drawImage(pc, px - 15, py - 22, 30, 37); const n = csum(k.c) + csum(k.m as any); g.fillStyle = '#fff'; g.font = '800 9px system-ui'; g.fillText('×' + n, px + 16, py - 10); }
    // effects
    for (const fx of s.fx) { const x = sx(fx.x), y = sy(fx.y); const ph = (t / 90 + fx.x) % 6;
      if (fx.k === 'boom') { const r = 6 + ph * 2.5; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,240,180,0.95)'); gr.addColorStop(0.5, 'rgba(255,120,40,0.7)'); gr.addColorStop(1, 'rgba(255,60,20,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      else if (fx.k === 'intercept') { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const a = i * 1.05 + ph; g.beginPath(); g.moveTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3); g.lineTo(x + Math.cos(a) * (6 + ph), y + Math.sin(a) * (6 + ph)); g.stroke(); } }
      else { g.strokeStyle = 'rgba(195,139,255,0.95)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 6; i++) g.lineTo(x - 10 + i * 4, y + (i % 2 ? -4 : 4)); g.stroke(); g.fillStyle = '#c38bff'; g.font = '800 8px system-ui'; g.fillText('JAM', x, y - 8); } }
  }
}
function star(g: CanvasRenderingContext2D, x: number, y: number, R: number, r: number) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 1; g.stroke(); }
