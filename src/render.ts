import { Sim, UNITS, UKey, Army, csum, EW_R, AIR_DEF_R, AWACS_R, RECON_R } from './sim';
import { World } from './world';
import { bigPiece, airSprite } from './pieces';
import { icon } from './icons';
const BICON: Record<string, string> = { barracks: 'base', factory: 'factory', airfield: 'airfield', port: 'port', missile: 'missile', ewstation: 'ew', samsite: 'sam', defense: 'bunker', stadium: 'stadium', skyscraper: 'skyscraper', bridge: 'bridge', techcampus: 'techcampus', powerplant: 'powerplant', hospital: 'hospital' };
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; k: 'smoke' | 'spark' | 'flash' | 'spiral' | 'static' | 'reveal'; r: number; a?: number; spr?: HTMLCanvasElement }
export const PLAYER_COLOR = 'hsl(200,85%,50%)';
export const PLAYER_FILL = 'hsl(200,45%,30%)';
export class Renderer {
  cv: HTMLCanvasElement; g: CanvasRenderingContext2D; w!: World; geo: Path2D[] = []; geoBox: number[][] = []; cells: Path2D[] = [];
  cam = { x: 0, y: 0, z: 1 }; dpr = Math.min(2, window.devicePixelRatio || 1); sel = -1; selArmy = -1; mode: 'none' | 'move' | 'strike' | 'scout' = 'none'; armyPos = new Map<number, [number, number]>();
  memory = new Map<number, { o: number; c: Record<string, number>; t: number }>(); prevV: Uint8Array | null = null; V: Uint8Array = new Uint8Array(0);
  parts: Particle[] = []; seenFx = new WeakSet<object>(); seenStrikes = new Set<number>(); blips = new Map<number, number>(); onThreat: ((r: number) => void) | null = null;
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
  draw(sim: Sim, frac = 0, dt = 16) {
    const { g, cam, w } = this; const s = sim.s; const V = this.V = sim.vision(s.player); const W = innerWidth, H = innerHeight, z = cam.z, D = this.dpr;
    g.setTransform(D, 0, 0, D, 0, 0); const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b1a28'); bg.addColorStop(1, '#061019'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.setTransform(D * z, 0, 0, D * z, -cam.x * z * D, -cam.y * z * D);
    g.strokeStyle = 'rgba(90,150,190,0.07)'; g.lineWidth = 1 / z; g.beginPath(); for (let x = 0; x <= w.w; x += 50) { g.moveTo(x, 0); g.lineTo(x, w.h); } for (let y = 0; y <= w.h; y += 50) { g.moveTo(0, y); g.lineTo(w.w, y); } g.stroke();
    const vx0 = cam.x, vy0 = cam.y, vx1 = cam.x + W / z, vy1 = cam.y + H / z;
    // coast glow
    g.lineWidth = 4 / z; g.strokeStyle = 'rgba(120,190,230,0.10)'; for (let i = 0; i < this.geo.length; i++) { const b = this.geoBox[i]; if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue; g.stroke(this.geo[i]); }
    for (let i = 0; i < this.geo.length; i++) { const b = this.geoBox[i]; if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue;
      g.save(); g.clip(this.geo[i]); for (const id of w.geoRegions[i]) { const o = s.regions[id].o; g.fillStyle = o === s.player ? PLAYER_FILL : this.w.nations[o].color; g.fill(this.cells[id]); }
      for (const id of w.geoRegions[i]) if (!V[id]) { g.fillStyle = 'rgba(3,7,11,0.55)'; g.fill(this.cells[id]); }
      g.lineWidth = 0.8 / z; g.strokeStyle = 'rgba(0,0,0,0.35)'; for (const id of w.geoRegions[i]) g.stroke(this.cells[id]);
      if (this.sel >= 0 && w.regions[this.sel].geo === i) { g.fillStyle = 'rgba(255,211,77,0.18)'; g.fill(this.cells[this.sel]); g.lineWidth = 2.5 / z; g.strokeStyle = '#ffd34d'; g.stroke(this.cells[this.sel]); }
      g.restore(); g.lineWidth = 1.2 / z; g.strokeStyle = 'rgba(10,14,18,0.9)'; g.stroke(this.geo[i]); }
    g.fillStyle = '#0a1724'; g.strokeStyle = 'rgba(120,190,230,0.25)'; g.lineWidth = 1 / z; for (const [x, y, r] of w.lakes) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); }
    // EW bubbles & SAM rings
    const t = performance.now();
    for (let i = 0; i < w.regions.length; i++) { const R = s.regions[i], P = w.regions[i]; if (P.x < vx0 - 100 || P.x > vx1 + 100 || P.y < vy0 - 100 || P.y > vy1 + 100) continue;
      if (R.b.ewstation && V[i]) { g.fillStyle = 'rgba(170,110,255,0.10)'; g.beginPath(); g.arc(P.x, P.y, EW_R, 0, 7); g.fill(); g.setLineDash([4 / z, 4 / z]); g.lineDashOffset = -t / 80 / z; g.strokeStyle = 'rgba(195,139,255,0.6)'; g.lineWidth = 1.2 / z; g.stroke(); g.setLineDash([]); }
      if (R.b.samsite && z > 1.1 && (R.o === s.player || i === this.sel)) { g.strokeStyle = 'rgba(255,90,60,0.35)'; g.lineWidth = 1 / z; g.beginPath(); g.arc(P.x, P.y, AIR_DEF_R, 0, 7); g.stroke(); } }
    for (const a of s.armies) if ((a.c.ew || 0) >= 8 && sim.seen(s.player, a, V)) { const [x, y] = this.armyXY(sim, a); if (x < vx0 - 60 || x > vx1 + 60) continue; g.fillStyle = 'rgba(170,110,255,0.06)'; g.beginPath(); g.arc(x, y, EW_R * 0.6, 0, 7); g.fill(); }
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
      if (z > 0.9 && V[i]) { const ks = Object.keys(R.b).filter(k => z > 2.6 || !['stadium', 'skyscraper', 'bridge', 'techcampus', 'powerplant', 'hospital'].includes(k)); const sm = Math.max(16, Math.min(24, 10 + z * 4)); g.fillStyle = 'rgba(5,10,15,0.65)'; if (ks.length) { g.beginPath(); g.roundRect(x - ks.length * sm / 2 - 2, y + rad + 13, ks.length * sm + 4, sm + 2, 4); g.fill(); } ks.forEach((k, j) => g.drawImage(icon(BICON[k], (R.b as any)[k], R.o === s.player, Math.round(sm * D)), x - ks.length * sm / 2 + j * sm, y + rad + 14, sm, sm)); if (R.q) { g.fillStyle = '#ffd34d'; g.font = '700 9px system-ui'; g.fillText('⚒' + R.q.left, x, y - rad - 4); } } }
    // ---------- radar sweeps & ping rings (renderer-only, time based) ----------
    const now = t / 1000; let radars = 0; const radarSrc: [number, number, number, boolean][] = [];
    for (let i = 0; i < w.regions.length; i++) { const R = s.regions[i]; if ((!R.b.samsite && !R.b.ewstation && !R.b.airfield) || !V[i]) continue; const P = w.regions[i]; radarSrc.push([P.x, P.y, R.b.samsite ? AIR_DEF_R : 70, R.o === s.player]); }
    for (const a of s.armies) if ((a.c.sam || 0) > 0 && !a.path.length && sim.seen(s.player, a, V)) { const P = w.regions[a.r]; radarSrc.push([P.x, P.y, AIR_DEF_R * 0.8, a.o === s.player]); }
    // AWACS: giant sweep + rotodome plane orbiting its airfield
    for (const a of s.armies) { if (!a.c.awacs || a.path.length || !sim.seen(s.player, a, V)) continue; const P = w.regions[a.r]; const x = sx(P.x), y = sy(P.y), rr = AWACS_R * z; if (x < -rr || y < -rr || x > W + rr || y > H + rr) continue;
      const mine = a.o === s.player; const col = mine ? '90,220,255' : '255,120,90'; const ang = (now * 0.9) % 6.283; g.save();
      const sw = g.createRadialGradient(x, y, 0, x, y, rr); sw.addColorStop(0, `rgba(${col},0)`); sw.addColorStop(1, `rgba(${col},0.18)`); g.fillStyle = sw; g.beginPath(); g.moveTo(x, y); g.arc(x, y, rr, ang - 1.1, ang); g.closePath(); g.fill();
      g.strokeStyle = `rgba(${col},0.9)`; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); g.stroke();
      for (let k = 0; k < 3; k++) { const ph = (now * 0.35 + k / 3) % 1; g.strokeStyle = `rgba(${col},${0.45 * (1 - ph)})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rr * ph, 0, 7); g.stroke(); }
      g.strokeStyle = `rgba(${col},0.3)`; g.setLineDash([6, 6]); g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, rr, 0, 7); g.stroke(); g.setLineDash([]);
      const an = now * 0.6 + a.id, orr = 34 + z * 5; const px = x + Math.cos(an) * orr, py = y + Math.sin(an) * orr * 0.6; const spr = airSprite('awacs', this.color(sim, a.o), Math.round(44 * D)); g.translate(px, py); g.rotate(an + Math.PI / 2); g.drawImage(spr, -22, -22, 44, 44); g.restore();
      g.font = '900 10px system-ui'; g.textAlign = 'center'; g.fillStyle = `rgb(${col})`; g.fillText('AWACS', px, py - 26); }
    if (z > 0.7) for (const [wx, wy, wr, mine] of radarSrc) { const x = sx(wx), y = sy(wy), rr = wr * z; if (x < -rr || y < -rr || x > W + rr || y > H + rr || radars > 24) continue; radars++;
      const ang = (now * 1.6 + wx * 0.01) % (Math.PI * 2); const col = mine ? '80,255,170' : '255,110,90';
      g.save(); g.beginPath(); g.moveTo(x, y); g.arc(x, y, rr, ang - 0.7, ang); g.closePath(); const sw = g.createRadialGradient(x, y, 0, x, y, rr); sw.addColorStop(0, `rgba(${col},0.0)`); sw.addColorStop(1, `rgba(${col},0.22)`); g.fillStyle = sw; g.fill();
      g.strokeStyle = `rgba(${col},0.75)`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); g.stroke();
      const ph = (now * 0.7 + wy * 0.003) % 1; g.strokeStyle = `rgba(${col},${0.5 * (1 - ph)})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rr * ph, 0, 7); g.stroke();
      g.strokeStyle = `rgba(${col},0.18)`; g.lineWidth = 1; g.beginPath(); g.arc(x, y, rr, 0, 7); g.stroke(); g.restore(); }
    // ---------- jamming static ----------
    if (z > 0.6) { const bubbles: [number, number, number][] = []; s.regions.forEach((R, i) => { if (R.b.ewstation && V[i]) bubbles.push([w.regions[i].x, w.regions[i].y, EW_R]); }); for (const a of s.armies) if ((a.c.ew || 0) > 0 && !a.path.length && sim.seen(s.player, a, V)) bubbles.push([w.regions[a.r].x, w.regions[a.r].y, EW_R * 0.6]);
      let nb = 0; for (const [wx, wy, wr] of bubbles) { const x = sx(wx), y = sy(wy), rr = wr * z; if (x < -rr || y < -rr || x > W + rr || y > H + rr || nb++ > 16) continue; const pulse = 0.5 + 0.5 * Math.sin(now * 4 + wx);
        const gr = g.createRadialGradient(x, y, rr * 0.2, x, y, rr); gr.addColorStop(0, `rgba(170,90,255,${0.05 + pulse * 0.06})`); gr.addColorStop(1, 'rgba(170,90,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
        g.fillStyle = `rgba(210,170,255,${0.35 + pulse * 0.3})`; const seed = Math.floor(now * 12); for (let k = 0; k < 40; k++) { const h1 = Math.sin((k + 1) * 12.9898 + seed * 78.233 + wx) * 43758.5453, h2 = Math.sin((k + 1) * 4.1414 + seed * 9.17 + wy) * 24634.6345; const rad = Math.sqrt(h1 - Math.floor(h1)) * rr, an = (h2 - Math.floor(h2)) * 6.283; g.fillRect(x + Math.cos(an) * rad, y + Math.sin(an) * rad, 2, 1.2); }
        g.strokeStyle = `rgba(195,139,255,${0.3 + pulse * 0.4})`; g.lineWidth = 1.5; g.setLineDash([3, 5]); g.lineDashOffset = -now * 20; g.beginPath(); g.arc(x, y, rr, 0, 7); g.stroke(); g.setLineDash([]); } }
    // ---------- armies as big chess pieces, clustered in screen space ----------
    this.armyPos.clear(); const minPx = 30, maxPx = 66; const base = Math.max(minPx, Math.min(maxPx, 16 + z * 10));
    type Cl = { x: number; y: number; ids: number[]; o: number; c: Record<string, number>; air: boolean; moving: boolean };
    const cl: Cl[] = [];
    const nowT = s.tick; for (const a of s.armies) if (a.o !== s.player && !a.path.length && sim.seen(s.player, a, V)) { const m = this.memory.get(a.r); const c: Record<string, number> = m && m.t === nowT ? m.c : {}; for (const k in a.c) c[k] = (c[k] || 0) + (a.c as any)[k]; this.memory.set(a.r, { o: a.o, c, t: nowT }); }
    for (const [r0, m] of this.memory) { if (V[r0] && m.t !== nowT) { this.memory.delete(r0); continue; } if (V[r0] || nowT - m.t > 600) continue; const P = w.regions[r0]; const x = sx(P.x), y = sy(P.y); if (x < -60 || y < -60 || x > W + 60 || y > H + 60) continue;
      const tp = Object.keys(m.c).sort((p, q) => m.c[q] - m.c[p])[0] as UKey; const sz = base * 0.85; const sp = bigPiece(tp, this.color(sim, m.o), Math.round(sz * D)); g.save(); g.globalAlpha = 0.38; g.filter = 'grayscale(0.7)'; g.drawImage(sp, x - sp.width / D / 2, y - sp.height / D * 0.86, sp.width / D, sp.height / D); g.restore(); g.font = '900 11px system-ui'; g.textAlign = 'center'; g.fillStyle = 'rgba(200,210,220,0.8)'; if (z > 1.8) g.fillText(`?${Object.values(m.c).reduce((a, b) => a + b, 0)}`, x, y + 14); }
    for (const a of s.armies) { if (!sim.seen(s.player, a, V)) continue; const [wx, wy] = this.armyXY(sim, a); const x = sx(wx), y = sy(wy); if (x < -60 || y < -60 || x > W + 60 || y > H + 60) continue; const air = sim.dom(a) === 'air';
      const ox = air ? base * 0.45 : 0, oy = air ? -base * 0.35 : 0;
      let hit = cl.find(c => c.o === a.o && c.air === air && Math.hypot(c.x - x - ox, c.y - y - oy) < base * (z > 3 ? 0.45 : 0.9));
      if (!hit) { hit = { x: x + ox, y: y + oy, ids: [], o: a.o, c: {}, air, moving: !!a.path.length }; cl.push(hit); }
      hit.ids.push(a.id); for (const k in a.c) hit.c[k] = (hit.c[k] || 0) + (a.c as any)[k]; }
    cl.sort((p, q) => (+(p.o === s.player) - +(q.o === s.player)) || p.y - q.y);
    for (const C of cl) { const mine = C.o === s.player; const n = Object.values(C.c).reduce((a, b) => a + b, 0); const selC = C.ids.includes(this.selArmy);
      const types = Object.keys(C.c).sort((p, q) => C.c[q] * UNITS[q as UKey].pp - C.c[p] * UNITS[p as UKey].pp) as UKey[];
      let size = base * (1 + Math.min(0.45, Math.log10(Math.max(1, n)) / 4)) * (C.air ? 0.8 : 1) * (selC ? 1.25 : 1) * (!mine && z < 2.2 ? 0.72 : 1); const bob = C.air ? Math.sin(now * 3 + C.x) * 3 : selC ? Math.sin(now * 5) * 2 : 0;
      const col = this.color(sim, C.o); const ph = Math.round(size * D);
      if (selC) { const gl = g.createRadialGradient(C.x, C.y, 2, C.x, C.y, size * 0.8); gl.addColorStop(0, 'rgba(255,211,77,0.55)'); gl.addColorStop(1, 'rgba(255,211,77,0)'); g.fillStyle = gl; g.beginPath(); g.arc(C.x, C.y, size * 0.8, 0, 7); g.fill(); }
      if (types.length > 1 && (z > 2.2 || selC)) types.slice(1, 3).forEach((tp, j) => { const s2 = size * 0.62; const sp = bigPiece(tp, col, Math.round(s2 * D)); const w2 = sp.width / D, h2 = sp.height / D; g.drawImage(sp, C.x + (j ? 0.35 : -1.05) * s2 - w2 * 0.1, C.y - h2 * 0.75 + 4, w2, h2); });
      const sp = bigPiece(types[0], col, ph); const pw = sp.width / D, phh = sp.height / D; const top = C.y - phh * 0.86 + bob; g.drawImage(sp, C.x - pw / 2, top, pw, phh);
      if (selC) { g.strokeStyle = '#ffd34d'; g.lineWidth = 3; g.beginPath(); g.ellipse(C.x, C.y + 2, size * 0.48, size * 0.15, 0, 0, 7); g.stroke(); }
      const label = (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)) + (C.ids.length > 1 ? ` ·${C.ids.length}` : ''); g.font = '900 12px system-ui'; const tw = g.measureText(label).width + 10;
      g.fillStyle = mine ? '#0b3554' : '#5a1616'; g.strokeStyle = mine ? '#8fd6ff' : '#ff9a8a'; g.lineWidth = 1.6; g.beginPath(); g.roundRect(C.x - tw / 2, C.y + 4, tw, 16, 8); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(label, C.x, C.y + 16);
      if (C.moving) { g.fillStyle = '#ffd34d'; g.beginPath(); g.moveTo(C.x + pw * 0.38, top + 4); g.lineTo(C.x + pw * 0.38 + 8, top + 9); g.lineTo(C.x + pw * 0.38, top + 14); g.fill(); }
      for (const id of C.ids) this.armyPos.set(id, [C.x, C.y - size * 0.4]); }
    // air patrols circling airfields
    if (z > 0.9) { let np = 0; for (const a of s.armies) { if (sim.dom(a) !== 'air' || a.path.length || !(a.c.fighter || a.c.uav) || !sim.seen(s.player, a, V)) continue; const P = w.regions[a.r]; const x = sx(P.x), y = sy(P.y); if (x < -80 || y < -80 || x > W + 80 || y > H + 80 || np > 20) continue; np++;
      const kind = a.c.fighter ? 'fighter' : 'uav'; const rr = 26 + z * 6; const sp = (kind === 'fighter' ? 1.3 : 0.7); const an = now * sp + a.id; const px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr * 0.6;
      const spr = airSprite(kind, this.color(sim, a.o), Math.round(30 * D)); g.save(); g.translate(px, py); g.rotate(an + Math.PI / 2); g.drawImage(spr, -15, -15, 30, 30); g.restore();
      if (np % 2 === 0) this.emit(px, py, 'smoke', 0.5, kind === 'fighter' ? 2 : 1.4); } }
    // selected army route
    const sa = s.armies.find(a => a.id === this.selArmy); if (sa && sa.path.length) { g.strokeStyle = 'rgba(255,211,77,0.9)'; g.setLineDash([8, 5]); g.lineWidth = 3; g.beginPath(); const [x0, y0] = this.armyXY(sim, sa); g.moveTo(sx(x0), sy(y0)); for (const q of sa.path) g.lineTo(sx(w.regions[q].x), sy(w.regions[q].y)); g.stroke(); g.setLineDash([]); }
    // ---------- strikes: curved animated flight ----------
    const defenders: [number, number, number, number][] = []; // x,y,range,owner (SAM engagement sources)
    s.regions.forEach((R, i) => { if (R.b.samsite) defenders.push([w.regions[i].x, w.regions[i].y, AIR_DEF_R, R.o]); }); for (const a of s.armies) if ((a.c.sam || 0) > 0) defenders.push([w.regions[a.r].x, w.regions[a.r].y, AIR_DEF_R * 0.8, a.o]);
    const offscreen: [number, number][] = [];
    const visAt = (x: number, y: number) => { let best = -1, bd = 1e9; for (let i = 0; i < w.regions.length; i++) { const d = (w.regions[i].x - x) ** 2 + (w.regions[i].y - y) ** 2; if (d < bd) { bd = d; best = i; } } return best >= 0 && V[best] > 0; };
    for (const k of s.strikes) { if (k.scout && !k.back && k.prog >= k.dist) { const T = w.regions[k.target]; if (k.o !== s.player && !V[k.target]) continue; const x = sx(T.x), y = sy(T.y), rr = RECON_R * z; const mine = k.o === s.player;
        if (mine) { g.save(); const ang = now * 2.2 % 6.283; const sw = g.createRadialGradient(x, y, 0, x, y, rr); sw.addColorStop(0, 'rgba(120,255,170,0)'); sw.addColorStop(1, 'rgba(120,255,170,0.25)'); g.fillStyle = sw; g.beginPath(); g.moveTo(x, y); g.arc(x, y, rr, ang - 0.9, ang); g.closePath(); g.fill(); g.strokeStyle = 'rgba(120,255,170,0.6)'; g.setLineDash([4, 4]); g.lineDashOffset = -now * 30; g.beginPath(); g.arc(x, y, rr, 0, 7); g.stroke(); g.setLineDash([]); g.restore(); }
        let j = 0; for (const u of Object.keys(k.c)) { const an = now * 1.2 + j * 2.1 + k.id; const px = x + Math.cos(an) * 30, py = y + Math.sin(an) * 18 - 14; const spr = airSprite(u, this.color(sim, k.o), Math.round(30 * D)); g.save(); g.translate(px, py); g.rotate(an + Math.PI / 2); g.drawImage(spr, -15, -15, 30, 30); g.restore(); j++; }
        g.font = '900 10px system-ui'; g.textAlign = 'center'; g.fillStyle = mine ? '#78ffaa' : '#ff8a7a'; g.fillText(`RECON ${k.hover}s`, x, y - 44); continue; }
      { const T0 = w.regions[k.back ? k.home : k.target]; const f0 = Math.min(1, k.prog / k.dist); if (k.o !== s.player && !(s.regions[k.target].o === s.player && !k.back) && !visAt(k.x0 + (T0.x - k.x0) * f0, k.y0 + (T0.y - k.y0) * f0)) continue; }
      const T = w.regions[k.back ? k.home : k.target]; const f = Math.min(1, (k.prog + k.spd * frac) / k.dist); const X0 = k.x0, Y0 = k.y0, X1 = T.x, Y1 = T.y; const lift = Math.hypot(X1 - X0, Y1 - Y0) * (Object.keys(k.m).includes('ballistic') ? 0.55 : 0.22);
      const bx = (u: number) => (1 - u) * (1 - u) * X0 + 2 * (1 - u) * u * (X0 + X1) / 2 + u * u * X1, by = (u: number) => (1 - u) * (1 - u) * Y0 + 2 * (1 - u) * u * ((Y0 + Y1) / 2 - lift) + u * u * Y1;
      const mine = k.o === s.player; const wxp = bx(f), wyp = by(f); const px = sx(wxp), py = sy(wyp); const hd = Math.atan2(by(Math.min(1, f + 0.01)) - wyp, bx(Math.min(1, f + 0.01)) - wxp);
      if (!this.seenStrikes.has(k.id)) { this.seenStrikes.add(k.id); if (!mine && !k.back && s.regions[k.target].o === s.player && this.onThreat) this.onThreat(k.target); }
      if (!mine && !k.back && s.regions[k.target].o === s.player && (px < 0 || py < 0 || px > W || py > H)) offscreen.push([px, py]);
      // predicted path (faint) + flown path
      g.strokeStyle = k.back ? 'rgba(150,200,255,0.15)' : mine ? 'rgba(108,196,255,0.35)' : 'rgba(255,110,90,0.4)'; g.setLineDash([3, 6]); g.lineWidth = 1.2; g.beginPath(); for (let u = f; u <= 1.001; u += 0.05) { const qx = sx(bx(u)), qy = sy(by(u)); u === f ? g.moveTo(qx, qy) : g.lineTo(qx, qy); } g.stroke(); g.setLineDash([]);
      const parts: [string, number][] = []; for (const u of Object.keys(k.c)) parts.push([u, (k.c as any)[u]]); for (const m of Object.keys(k.m)) parts.push([m === 'ballistic' ? 'ballistic' : 'missile', (k.m as any)[m]]);
      parts.slice(0, 4).forEach(([kind, cnt], j) => { const lag = j * 0.02; const u = Math.max(0, f - lag); const qx = sx(bx(u)) + Math.sin(now * 2 + j) * (kind === 'uav' || kind === 'loiter' ? 3 : 1), qy = sy(by(u)) + Math.cos(now * 3 + j) * (kind === 'uav' || kind === 'loiter' ? 3 : 1);
        const isM = kind === 'missile' || kind === 'ballistic'; const pxs = Math.round((isM ? 30 : kind === 'bomber' ? 44 : kind === 'fighter' ? 38 : 32) * D); const spr = airSprite(kind === 'recon' ? 'recon' : kind, this.color(sim, k.o), pxs);
        g.save(); g.translate(qx, qy); g.rotate(hd); g.drawImage(spr, -pxs / D / 2, -pxs / D / 2, pxs / D, pxs / D);
        if (kind === 'uav' || kind === 'recon') { g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; const pa = now * 40; g.beginPath(); g.moveTo(-pxs / D * 0.42, Math.sin(pa) * 5); g.lineTo(-pxs / D * 0.42, -Math.sin(pa) * 5); g.stroke(); }
        if (isM) { g.fillStyle = `rgba(255,${180 + Math.random() * 60},80,0.9)`; g.beginPath(); g.arc(-pxs / D * 0.45, 0, 3 + Math.random() * 2, 0, 7); g.fill(); }
        g.restore(); if (cnt > 1) { g.font = '900 11px system-ui'; g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText('×' + cnt, qx + 18, qy - 10); g.fillStyle = '#fff'; g.fillText('×' + cnt, qx + 18, qy - 10); }
        const tx = qx - Math.cos(hd) * pxs / D * 0.5, ty = qy - Math.sin(hd) * pxs / D * 0.5; this.emit(tx, ty, 'smoke', isM ? 1.4 : 0.9, isM ? 3.2 : kind === 'fighter' || kind === 'bomber' ? 2.2 : 1.2); });
      // radar blips + SAM lock-on lines on hostile incoming
      if (!k.back) for (const [dx, dy, dr, own] of defenders) { if (own === k.o) continue; if (Math.hypot(dx - wxp, dy - wyp) > dr * 1.25) continue; const qx = sx(dx), qy = sy(dy);
        const lock = Math.hypot(dx - wxp, dy - wyp) < dr; g.strokeStyle = lock ? `rgba(255,60,40,${0.5 + 0.5 * Math.sin(now * 20)})` : 'rgba(255,200,80,0.5)'; g.lineWidth = lock ? 2 : 1; g.setLineDash(lock ? [] : [4, 4]); g.beginPath(); g.moveTo(qx, qy); g.lineTo(px, py); g.stroke(); g.setLineDash([]);
        if (lock) { g.strokeStyle = '#ff3c28'; g.lineWidth = 2; const b2 = 14 + Math.sin(now * 10) * 3; g.strokeRect(px - b2, py - b2, b2 * 2, b2 * 2); g.font = '900 9px system-ui'; g.fillStyle = '#ff3c28'; g.fillText('LOCK', px, py - b2 - 3); }
        g.fillStyle = `rgba(120,255,170,${0.6 + 0.4 * Math.sin(now * 8)})`; g.beginPath(); g.arc(px, py, 4, 0, 7); g.fill(); g.strokeStyle = 'rgba(120,255,170,0.5)'; g.beginPath(); g.arc(px, py, 4 + ((now * 30) % 14), 0, 7); g.stroke(); break; } }
    // off-screen incoming threat markers
    for (const [px, py] of offscreen.slice(0, 6)) { const cx = Math.max(24, Math.min(W - 24, px)), cy = Math.max(120, Math.min(H - 24, py)); const an = Math.atan2(py - cy, px - cx); g.save(); g.translate(cx, cy); g.rotate(an); g.fillStyle = `rgba(255,60,40,${0.6 + 0.4 * Math.sin(now * 10)})`; g.beginPath(); g.moveTo(14, 0); g.lineTo(-8, -9); g.lineTo(-8, 9); g.closePath(); g.fill(); g.restore(); g.fillStyle = '#ff3c28'; g.font = '900 10px system-ui'; g.fillText('INCOMING', cx, cy + 20); }
    if (this.prevV && this.prevV.length === V.length) { let nfl = 0; for (let i = 0; i < V.length && nfl < 10; i++) if (V[i] && !this.prevV[i]) { const x = sx(w.regions[i].x), y = sy(w.regions[i].y); if (x > -20 && y > -20 && x < W + 20 && y < H + 20) { const p = this.emit(x, y, 'reveal', 1.2, 30); nfl++; void p; } } }
    this.prevV = V.slice();
    // sim fx -> particle bursts (once each)
    for (const fx of s.fx) { if (this.seenFx.has(fx)) continue; this.seenFx.add(fx); const x = sx(fx.x), y = sy(fx.y);
      if (fx.k === 'boom') { this.emit(x, y, 'flash', 1, 22); for (let i = 0; i < 10; i++) this.emit(x, y, 'spark', 1, 2); for (let i = 0; i < 5; i++) this.emit(x, y, 'smoke', 2, 6); }
      else if (fx.k === 'intercept') { const ax = x + (Math.random() - 0.5) * 60, ay = y - 30 - Math.random() * 40; this.emit(ax, ay, 'flash', 0.8, 16); for (let i = 0; i < 8; i++) this.emit(ax, ay, 'spark', 0.8, 1.6); }
      else { const p = this.emit(x - 20, y - 20, 'spiral', 2.2, 1); if (p) p.spr = airSprite('uav', '#888', Math.round(26 * D)); for (let i = 0; i < 6; i++) this.emit(x, y, 'static', 1, 2); } }
    this.tickParticles(g, dt / 1000);
  }
  emit(x: number, y: number, k: Particle['k'], life: number, r: number) { if (this.parts.length > (this.cam.z < 1 ? 120 : 300)) return null; const a = Math.random() * 6.283, sp = k === 'spark' ? 40 + Math.random() * 80 : k === 'smoke' ? 6 : 0;
    const p: Particle = { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (k === 'smoke' ? 4 : 0), life, max: life, k, r, a: Math.random() * 6 }; this.parts.push(p); return p; }
  tickParticles(g: CanvasRenderingContext2D, dt: number) { const D = this.dpr;
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; const f = Math.max(0, p.life / p.max);
      if (p.k === 'smoke') { g.fillStyle = `rgba(220,225,230,${0.35 * f})`; g.beginPath(); g.arc(p.x, p.y, p.r * (1.6 - f), 0, 7); g.fill(); }
      else if (p.k === 'spark') { p.vy += 60 * dt; g.fillStyle = `rgba(255,${200 * f + 40},60,${f})`; g.fillRect(p.x, p.y, 2.2, 2.2); }
      else if (p.k === 'flash') { const r = p.r * (1.4 - f); const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); gr.addColorStop(0, `rgba(255,250,210,${f})`); gr.addColorStop(0.4, `rgba(255,150,40,${0.8 * f})`); gr.addColorStop(1, 'rgba(255,60,20,0)'); g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill(); g.strokeStyle = `rgba(255,255,255,${0.6 * f})`; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, r * 1.3, 0, 7); g.stroke(); }
      else if (p.k === 'spiral') { p.a! += dt * 8; const rr = 18 * (1 - f) + 6; const x = p.x + Math.cos(p.a!) * rr, y = p.y + Math.sin(p.a!) * rr + (1 - f) * 40; if (p.spr) { g.save(); g.globalAlpha = f; g.translate(x, y); g.rotate(p.a! + 1.57); g.drawImage(p.spr, -13, -13, 26, 26); g.restore(); } g.fillStyle = `rgba(195,139,255,${f})`; g.font = '900 10px system-ui'; g.fillText('JAMMED', p.x, p.y - 26); this.parts.length < 300 && Math.random() < 0.5 && this.parts.push({ x, y, vx: 0, vy: -3, life: 0.6, max: 0.6, k: 'smoke', r: 2 }); }
      else if (p.k === 'reveal') { const r = p.r * (1.3 - f) + 6; g.strokeStyle = `rgba(120,255,200,${f})`; g.lineWidth = 2.5; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.stroke(); g.fillStyle = `rgba(120,255,200,${0.15 * f})`; g.fill(); }
      else { g.strokeStyle = `rgba(195,139,255,${f})`; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i < 5; i++) g.lineTo(p.x - 8 + i * 4 + p.vx * 0.05, p.y + (i % 2 ? -3 : 3)); g.stroke(); } }
    void D; this.parts = this.parts.filter(p => p.life > 0); }
}
function star(g: CanvasRenderingContext2D, x: number, y: number, R: number, r: number) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 1; g.stroke(); }
