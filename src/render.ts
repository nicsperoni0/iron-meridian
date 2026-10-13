// v4 renderer: painted terrain, translucent ownership tints, banner unit markers + vehicle sprites, radar circles.
import { Sim, UNITS, UKey, Army, csum, EW_R, AIR_DEF_R, AWACS_R, RECON_R } from './sim';
import { World } from './world';
import { landTexture, oceanTexture, cityTexture, peak, flag, glyph, vehicle, pin } from './sprites';
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; k: 'smoke' | 'spark' | 'flash' | 'spiral' | 'reveal'; r: number; a?: number }
export const PLAYER_COLOR = '#5fbf3a';
export const cityLevel = (pop: number) => pop < 3e5 ? 1 : pop < 1e6 ? 2 : pop < 3e6 ? 3 : pop < 8e6 ? 4 : 5;
const PIN_ORDER = ['missile', 'airfield', 'factory', 'samsite', 'ewstation', 'port', 'barracks', 'defense'];
export class Renderer {
  cv: HTMLCanvasElement; g: CanvasRenderingContext2D; w!: World; geo: Path2D[] = []; geoBox: number[][] = []; cells: Path2D[] = []; nationLabel: { n: number; x: number; y: number; size: number }[] = [];
  cam = { x: 0, y: 0, z: 3 }; dpr = Math.min(2, window.devicePixelRatio || 1); sel = -1; selArmy = -1; mode: 'none' | 'move' | 'strike' | 'scout' = 'none'; armyPos = new Map<number, [number, number]>();
  memory = new Map<number, { o: number; c: Record<string, number>; t: number }>(); prevV: Uint8Array | null = null; V: Uint8Array = new Uint8Array(0);
  parts: Particle[] = []; seenFx = new WeakSet<object>(); seenStrikes = new Set<number>(); onThreat: ((r: number) => void) | null = null;
  landPat: CanvasPattern | null = null; seaPat: CanvasPattern | null = null;
  constructor(cv: HTMLCanvasElement) { this.cv = cv; this.g = cv.getContext('2d')!; this.resize(); this.landPat = this.g.createPattern(landTexture(), 'repeat'); this.seaPat = this.g.createPattern(oceanTexture(), 'repeat'); }
  setWorld(w: World) { this.w = w;
    this.geo = w.geoPolys.map(ps => { const P = new Path2D(); for (const r of ps) { P.moveTo(r[0], r[1]); for (let i = 2; i < r.length; i += 2) P.lineTo(r[i], r[i + 1]); P.closePath(); } return P; });
    this.geoBox = w.geoPolys.map(ps => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const r of ps) for (let i = 0; i < r.length; i += 2) { a = Math.min(a, r[i]); c = Math.max(c, r[i]); b = Math.min(b, r[i + 1]); d = Math.max(d, r[i + 1]); } return [a, b, c, d]; });
    this.cells = w.regions.map(r => { const P = new Path2D(); const c = r.cell; if (c.length) { P.moveTo(c[0], c[1]); for (let i = 2; i < c.length; i += 2) P.lineTo(c[i], c[i + 1]); P.closePath(); } return P; });
    this.nationLabel = w.nations.map((_, n) => { const rs = w.regions.filter(r => r.nation === n); if (!rs.length) return null; let x = 0, y = 0; rs.forEach(r => { x += r.x; y += r.y; }); const b = this.geoBox[rs[0].geo]; return { n, x: x / rs.length, y: y / rs.length, size: Math.sqrt((b[2] - b[0]) * (b[3] - b[1])) }; }).filter(Boolean) as any; }
  resize() { this.cv.width = innerWidth * this.dpr; this.cv.height = innerHeight * this.dpr; this.cv.style.width = innerWidth + 'px'; this.cv.style.height = innerHeight + 'px'; }
  color(sim: Sim, o: number) { return o === sim.s.player ? PLAYER_COLOR : this.w.nations[o].color; }
  hostile(sim: Sim, o: number) { const s = sim.s; return o !== s.player && (s.nations[o].target === s.player || s.nations[s.player].target === o); }
  focus(r: number, z = 3.6) { const R = this.w.regions[r]; this.cam.z = z; this.cam.x = R.x - innerWidth / 2 / z; this.cam.y = R.y - innerHeight / 2.4 / z; }
  toWorld(sx: number, sy: number) { return [sx / this.cam.z + this.cam.x, sy / this.cam.z + this.cam.y]; }
  pickArmy(sx: number, sy: number) { let best = -1, bd = 30; for (const [id, [x, y]] of this.armyPos) { const d = Math.hypot(x - sx, y - sy); if (d < bd) { bd = d; best = id; } } return best; }
  pickRegion(sx: number, sy: number) { const [x, y] = this.toWorld(sx, sy); this.g.setTransform(1, 0, 0, 1, 0, 0);
    for (const [lx, ly, lr] of this.w.lakes) if ((x - lx) ** 2 + (y - ly) ** 2 < lr * lr) return -1;
    let geo = -1; for (let i = this.geo.length - 1; i >= 0; i--) { const b = this.geoBox[i]; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue; if (this.g.isPointInPath(this.geo[i], x, y)) { geo = i; break; } }
    if (geo < 0) { let best = -1, bd = 25; this.w.regions.forEach((r, i) => { const d = Math.hypot(r.x - x, r.y - y); if (d < bd) { bd = d; best = i; } }); return best; }
    let best = -1, bd = 1e9; for (const id of this.w.geoRegions[geo]) { const r = this.w.regions[id]; const d = (r.x - x) ** 2 + (r.y - y) ** 2; if (d < bd) { bd = d; best = id; } } return best; }
  armyXY(sim: Sim, a: Army, frac = 0): [number, number] { const R = this.w.regions[a.r]; if (!a.path.length) return [R.x, R.y]; const Q = this.w.regions[a.path[0]]; const e = sim.edgeBetween(a.r, a.path[0]); const f = e >= 0 ? Math.min(1, (a.prog + frac * 3) / this.w.edges[e].len) : 0; return [R.x + (Q.x - R.x) * f, R.y + (Q.y - R.y) * f]; }
  draw(sim: Sim, frac = 0, dt = 16) {
    const { g, cam, w } = this; const s = sim.s; const V = this.V = sim.vision(s.player); const W = innerWidth, H = innerHeight, z = cam.z, D = this.dpr; const now = performance.now() / 1000;
    const sx = (x: number) => (x - cam.x) * z, sy = (y: number) => (y - cam.y) * z;
    const hostileSet = new Set<number>(); s.nations.forEach((_, o) => { if (this.hostile(sim, o)) hostileSet.add(o); });
    // ocean
    g.setTransform(D, 0, 0, D, 0, 0); g.fillStyle = '#1d4d78'; g.fillRect(0, 0, W, H);
    if (this.seaPat) { const m = new DOMMatrix().translateSelf(-cam.x * z, -cam.y * z).scaleSelf(z * 0.35, z * 0.35); this.seaPat.setTransform(m); g.fillStyle = this.seaPat; g.fillRect(0, 0, W, H); }
    const vg = g.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(10,30,50,0.15)'); vg.addColorStop(1, 'rgba(5,20,40,0.35)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.setTransform(D * z, 0, 0, D * z, -cam.x * z * D, -cam.y * z * D);
    const vx0 = cam.x, vy0 = cam.y, vx1 = cam.x + W / z, vy1 = cam.y + H / z;
    if (this.landPat) this.landPat.setTransform(new DOMMatrix().scaleSelf(0.35, 0.35));
    // coastal shallows glow
    g.lineWidth = 5 / z + 2; g.strokeStyle = 'rgba(120,190,215,0.25)'; for (let i = 0; i < this.geo.length; i++) { const b = this.geoBox[i]; if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue; g.stroke(this.geo[i]); }
    for (let i = 0; i < this.geo.length; i++) { const b = this.geoBox[i]; if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue;
      g.save(); g.clip(this.geo[i]); g.fillStyle = this.landPat || '#5d8a3c'; g.fill(this.geo[i]);
      for (const id of w.geoRegions[i]) { const R = w.regions[id]; const o = s.regions[id].o;
        if (R.terrain === 3) { g.fillStyle = 'rgba(70,65,50,0.30)'; g.fill(this.cells[id]); } else if (R.terrain === 2) { g.fillStyle = 'rgba(80,90,50,0.18)'; g.fill(this.cells[id]); }
        if (o === s.player) { g.fillStyle = 'rgba(175,245,70,0.55)'; g.fill(this.cells[id]); } else if (hostileSet.has(o)) { g.fillStyle = 'rgba(190,35,25,0.55)'; g.fill(this.cells[id]); }
        if (!V[id]) { g.fillStyle = 'rgba(25,35,45,0.28)'; g.fill(this.cells[id]); } }
      g.lineWidth = 0.9 / z; g.strokeStyle = 'rgba(255,255,255,0.55)'; for (const id of w.geoRegions[i]) g.stroke(this.cells[id]);
      if (this.sel >= 0 && w.regions[this.sel].geo === i) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fill(this.cells[this.sel]); g.lineWidth = 2.5 / z; g.strokeStyle = '#ffffff'; g.stroke(this.cells[this.sel]); }
      // red outline where hostile ownership meets other ownership (clipped to land)
      for (const id of w.geoRegions[i]) { const o = s.regions[id].o; if (!hostileSet.has(o)) continue; if (!w.adj[id].some(a => s.regions[a.to].o !== o)) continue; g.lineWidth = 2.2 / z; g.strokeStyle = 'rgba(235,60,50,0.8)'; g.stroke(this.cells[id]); }
      g.restore(); g.lineWidth = 2 / z; g.strokeStyle = 'rgba(30,35,30,0.85)'; g.stroke(this.geo[i]); }
    g.fillStyle = '#245a86'; g.strokeStyle = 'rgba(160,210,230,0.4)'; g.lineWidth = 1.5 / z; for (const [x, y, r] of w.lakes) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); }
    // roads & sea lanes
    w.edges.forEach((e, i) => { const A = w.regions[e.a], B = w.regions[e.b]; if (Math.max(A.x, B.x) < vx0 || Math.min(A.x, B.x) > vx1 || Math.max(A.y, B.y) < vy0 || Math.min(A.y, B.y) > vy1) return; const k = s.roads[i];
      if (k === 2) { g.strokeStyle = 'rgba(35,38,40,0.75)'; g.lineWidth = 1.6 / z; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); }
      else if (k === 1) { g.strokeStyle = 'rgba(35,38,40,0.5)'; g.setLineDash([3 / z, 3 / z]); g.lineWidth = 1.2 / z; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); g.setLineDash([]); }
      else { g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1 / z; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); if (z > 1.5) { const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.2 / z; for (const dy of [-1.2, 1.2]) { g.beginPath(); g.moveTo(mx - 3, my + dy); g.quadraticCurveTo(mx - 1.5, my + dy - 1.2, mx, my + dy); g.quadraticCurveTo(mx + 1.5, my + dy + 1.2, mx + 3, my + dy); g.stroke(); } } } });
    // ---- screen space ----
    g.setTransform(D, 0, 0, D, 0, 0);
    // terrain peaks + city textures
    for (let i = 0; i < w.regions.length; i++) { const P = w.regions[i]; const x = sx(P.x), y = sy(P.y); if (x < -80 || y < -80 || x > W + 80 || y > H + 80) continue;
      if (z > 1.6 && P.terrain >= 2) { const ps = Math.round(Math.min(26, 6 + z * 3) * D); for (let k = 0; k < (P.terrain === 3 ? 4 : 2); k++) { const ox = Math.sin(i * 7.1 + k * 2.3) * 18 * (z / 3), oy = Math.cos(i * 3.7 + k * 1.9) * 14 * (z / 3); g.drawImage(peak(ps), x + ox - ps / D / 2, y + oy + 10 - ps / D / 2, ps / D, ps / D); } }
      if (z > 2.0) { const lv = cityLevel(P.pop); const cs = Math.min(110, (14 + lv * 7) * z * 0.45); const ct = cityTexture(lv, Math.round(cs * D)); g.drawImage(ct, x - cs / 2, y - cs / 2, cs, cs); } }
    // radar & air-defense range circles
    const circles: [number, number, number, boolean][] = [];
    s.regions.forEach((R, i) => { if (!V[i]) return; const P = w.regions[i]; if (R.b.samsite && (R.o === s.player || hostileSet.has(R.o))) circles.push([P.x, P.y, AIR_DEF_R, R.o === s.player]); else if (R.o === s.player && (R.b.airfield || R.b.ewstation)) circles.push([P.x, P.y, 70, true]); });
    for (const a of s.armies) { if (a.path.length || !sim.seen(s.player, a, V)) continue; const P = w.regions[a.r]; if (a.c.sam && (a.o === s.player || hostileSet.has(a.o))) circles.push([P.x, P.y, AIR_DEF_R * 0.8, a.o === s.player]); if (a.c.awacs && a.o === s.player) circles.push([P.x, P.y, AWACS_R, true]); }
    const uOwn = new Path2D(), uFoe = new Path2D(); let nc = 0; for (const [wx, wy, wr, mine] of circles) { const x = sx(wx), y = sy(wy), rr = wr * z; if (x < -rr || y < -rr || x > W + rr || y > H + rr || nc++ > 30) continue;
      const host = !mine; (mine ? uOwn : uFoe).moveTo(x + rr, y); (mine ? uOwn : uFoe).arc(x, y, rr, 0, 7); g.beginPath(); g.arc(x, y, rr, 0, 7); g.strokeStyle = mine ? 'rgba(200,235,255,0.75)' : 'rgba(255,120,110,0.7)'; g.lineWidth = 1.5; g.stroke();
      const ang = (now * 1.2 + wx) % 6.283; const sw = g.createRadialGradient(x, y, 0, x, y, rr); sw.addColorStop(0, 'rgba(255,255,255,0)'); sw.addColorStop(1, host ? 'rgba(255,170,160,0.25)' : 'rgba(230,248,255,0.30)'); g.fillStyle = sw; g.beginPath(); g.moveTo(x, y); g.arc(x, y, rr, ang - 0.6, ang); g.closePath(); g.fill();
      const ph = (now * 0.6 + wy * 0.01) % 1; g.strokeStyle = `rgba(255,255,255,${0.45 * (1 - ph)})`; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, rr * ph, 0, 7); g.stroke(); }
    g.fillStyle = 'rgba(150,215,255,0.2)'; g.fill(uOwn); g.fillStyle = 'rgba(230,70,60,0.2)'; g.fill(uFoe);
    // jamming zones: soft purple static
    const bubbles: [number, number, number][] = []; s.regions.forEach((R, i) => { if (R.b.ewstation && V[i]) bubbles.push([w.regions[i].x, w.regions[i].y, EW_R]); }); for (const a of s.armies) if ((a.c.ew || 0) > 0 && !a.path.length && sim.seen(s.player, a, V)) bubbles.push([w.regions[a.r].x, w.regions[a.r].y, EW_R * 0.6]);
    let nb = 0; for (const [wx, wy, wr] of bubbles) { const x = sx(wx), y = sy(wy), rr = wr * z; if (x < -rr || y < -rr || x > W + rr || y > H + rr || nb++ > 12) continue; const pulse = 0.5 + 0.5 * Math.sin(now * 3 + wx);
      g.strokeStyle = `rgba(190,140,255,${0.35 + 0.3 * pulse})`; g.setLineDash([5, 6]); g.lineDashOffset = -now * 15; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, rr, 0, 7); g.stroke(); g.setLineDash([]);
      g.fillStyle = `rgba(210,180,255,${0.25 + 0.25 * pulse})`; const seed = Math.floor(now * 10); for (let k = 0; k < 28; k++) { const h1 = Math.sin((k + 1) * 12.99 + seed * 78.2 + wx) * 43758.5, h2 = Math.sin((k + 1) * 4.14 + seed * 9.1 + wy) * 24634.6; const rad = Math.sqrt(h1 - Math.floor(h1)) * rr, an = (h2 - Math.floor(h2)) * 6.283; g.fillRect(x + Math.cos(an) * rad, y + Math.sin(an) * rad, 2, 1); } }
    // labels
    g.textAlign = 'center'; g.lineJoin = 'round';
    if (z < 3.2) for (const L of this.nationLabel) { if (L.size * z < 50) continue; const x = sx(L.x), y = sy(L.y); if (x < -100 || y < -30 || x > W + 100 || y > H + 30) continue; const fs = Math.max(10, Math.min(18, L.size * z / 9));
      g.font = `italic 900 ${fs}px system-ui`; const txt = w.nations[L.n].name.toUpperCase(); g.lineWidth = 3.5; g.strokeStyle = 'rgba(20,22,20,0.85)'; spaced(g, txt, x, y, fs * 0.08, true); g.fillStyle = '#fff'; spaced(g, txt, x, y, fs * 0.08, false); }
    if (z >= 2.0) for (let i = 0; i < w.regions.length; i++) { const P = w.regions[i]; const x = sx(P.x), y = sy(P.y); if (x < -80 || y < -40 || x > W + 80 || y > H + 40) continue; if (z < 3 && P.pop < 1.5e6 && !P.cap) continue;
      const fs = Math.min(15, 9 + z * 1.2); g.font = `italic 800 ${fs}px system-ui`; const txt = `${P.n}(${cityLevel(P.pop)})`; g.lineWidth = 3.5; g.strokeStyle = 'rgba(25,25,25,0.9)'; g.strokeText(txt, x, y + 26 + z * 2); g.fillStyle = '#fff'; g.fillText(txt, x, y + 26 + z * 2); }
    // city building pins
    if (z > 1.4) for (let i = 0; i < w.regions.length; i++) { const R = s.regions[i]; if (!V[i] || (z < 4.5 && R.o !== s.player && !hostileSet.has(R.o))) continue; const k = PIN_ORDER.find(b => (R.b as any)[b]); if (!k) continue; const P = w.regions[i]; const x = sx(P.x), y = sy(P.y); if (x < -40 || y < -60 || x > W + 40 || y > H + 40) continue;
      const ps = Math.min(34, 18 + z * 3); const pc = pin(k, Math.round(ps * D)); g.drawImage(pc, x - ps / 2 - 10, y - ps * 1.3 - 2, ps, ps * 1.3); if (R.q) { g.font = '800 10px system-ui'; g.fillStyle = '#ffe680'; g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeText('⚒' + R.q.left, x - 10, y - ps * 1.3 - 4); g.fillText('⚒' + R.q.left, x - 10, y - ps * 1.3 - 4); } }
    // ---- units: vehicle sprite + flag banner marker ----
    this.armyPos.clear(); const spx = Math.max(26, Math.min(64, 14 + z * 7));
    const nowT = s.tick; for (const a of s.armies) if (a.o !== s.player && !a.path.length && sim.seen(s.player, a, V)) { const m = this.memory.get(a.r); const c: Record<string, number> = m && m.t === nowT ? m.c : {}; for (const k in a.c) c[k] = (c[k] || 0) + (a.c as any)[k]; this.memory.set(a.r, { o: a.o, c, t: nowT }); }
    type Cl = { x: number; y: number; ids: number[]; o: number; c: Record<string, number>; air: boolean; moving: boolean; ghost?: boolean; hd: number };
    const cl: Cl[] = [];
    for (const [r0, m] of this.memory) { if (V[r0] && m.t !== nowT) { this.memory.delete(r0); continue; } if (V[r0] || nowT - m.t > 600 || (z < 4.5 && !hostileSet.has(m.o))) continue; const P = w.regions[r0]; cl.push({ x: sx(P.x), y: sy(P.y), ids: [], o: m.o, c: m.c, air: false, moving: false, ghost: true, hd: 0 }); }
    for (const a of s.armies) { if (!sim.seen(s.player, a, V)) continue; if (z < 4.5 && a.o !== s.player && !hostileSet.has(a.o)) continue; const [wx, wy] = this.armyXY(sim, a, frac); const x = sx(wx), y = sy(wy); if (x < -70 || y < -70 || x > W + 70 || y > H + 70) continue; const air = sim.dom(a) === 'air';
      const ox = air ? spx * 0.7 : 0, oy = air ? spx * 0.35 : 0; let hd = 0; if (a.path.length) { const Q = w.regions[a.path[0]]; hd = Math.atan2(Q.y - wy, Q.x - wx); }
      let hit = cl.find(c => !c.ghost && c.o === a.o && c.air === air && Math.hypot(c.x - x - ox, c.y - y - oy) < spx * 1.7);
      if (!hit) { hit = { x: x + ox, y: y + oy, ids: [], o: a.o, c: {}, air, moving: !!a.path.length, hd }; cl.push(hit); } hit.ids.push(a.id); for (const k in a.c) hit.c[k] = (hit.c[k] || 0) + (a.c as any)[k]; }
    cl.sort((p, q) => p.y - q.y);
    for (const C of cl) { const mine = C.o === s.player; const n = Object.values(C.c).reduce((a, b) => a + b, 0); const selC = C.ids.includes(this.selArmy);
      const types = Object.keys(C.c).sort((p, q) => C.c[q] * UNITS[q as UKey].pp - C.c[p] * UNITS[p as UKey].pp) as UKey[]; const top = types[0]; if (!top) continue;
      g.save(); if (C.ghost) g.globalAlpha = 0.45;
      if (selC) { const pr = spx * (0.7 + 0.08 * Math.sin(now * 5)); g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(C.x, C.y + 4, pr, pr * 0.45, 0, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fill(); }
      // vehicle sprite(s)
      const vs = Math.round(spx * (C.air ? 1.1 : 1) * D); const show = (C.air ? types.filter(t => t !== 'recon') : types).slice(0, z > 5 ? 2 : 1);
      show.forEach((t, j) => { const sp = vehicle(t, vs); const off = j ? spx * 0.45 : 0; const lift = C.air ? 10 : 0; const ang = C.moving ? C.hd : (C.air ? -0.6 : -0.25);
        if (C.air) { g.save(); g.globalAlpha *= 0.35; g.translate(C.x + off + 8, C.y + 10); g.rotate(ang); g.filter = 'brightness(0)'; g.drawImage(sp, -vs / D / 2, -vs / D / 2, vs / D, vs / D); g.restore(); }
        g.save(); g.translate(C.x + off, C.y - lift + (j ? spx * 0.25 : 0)); g.rotate(ang); g.drawImage(sp, -vs / D / 2, -vs / D / 2, vs / D, vs / D); g.restore(); });
      // banner marker: pin + flag + colored box with glyph & count
      const host = hostileSet.has(C.o) && !mine; const bx = C.x + spx * 0.25, by = C.y - spx * 0.95;
      g.strokeStyle = 'rgba(20,20,20,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, by + 18); g.lineTo(C.x + spx * 0.1, C.y - spx * 0.2); g.stroke();
      const fl = flag(C.o, Math.round(24 * D)); g.drawImage(fl, bx, by - 14, 24, 16); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; g.strokeRect(bx, by - 14, 24, 16);
      const label = C.ghost ? '?' : (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)); g.font = '900 12px system-ui'; const bw = 22 + g.measureText(label).width + 6;
      const boxG = g.createLinearGradient(0, by, 0, by + 20); boxG.addColorStop(0, C.ghost ? '#8a949c' : mine ? '#5cc23a' : host ? '#d8463a' : '#8a9aa6'); boxG.addColorStop(1, C.ghost ? '#5d666d' : mine ? '#2f8a1e' : host ? '#9a1f17' : '#56656f');
      g.fillStyle = boxG; g.fillRect(bx, by + 2, bw, 19); g.strokeStyle = selC ? '#ffe680' : 'rgba(255,255,255,0.9)'; g.lineWidth = selC ? 2.5 : 1.3; g.strokeRect(bx, by + 2, bw, 19);
      glyph(g, top, bx + 11, by + 11.5, 15); g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(label, bx + 22, by + 16.5); g.textAlign = 'center';
      if (C.moving) { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(bx + bw + 3, by + 6); g.lineTo(bx + bw + 9, by + 11.5); g.lineTo(bx + bw + 3, by + 17); g.fill(); }
      g.restore(); for (const id of C.ids) { this.armyPos.set(id, [bx + bw / 2, by + 10]); } if (C.ids.length) this.armyPos.set(C.ids[0], [C.x, C.y]); }
    // selected army route (red/white)
    const sa = s.armies.find(a => a.id === this.selArmy); if (sa && sa.path.length) { g.strokeStyle = 'rgba(255,255,255,0.85)'; g.setLineDash([8, 6]); g.lineWidth = 3; g.beginPath(); const [x0, y0] = this.armyXY(sim, sa, frac); g.moveTo(sx(x0), sy(y0)); for (const q of sa.path) g.lineTo(sx(w.regions[q].x), sy(w.regions[q].y)); g.stroke(); g.setLineDash([]); }
    // air patrols around airfields
    if (z > 1.2) { let np = 0; for (const a of s.armies) { if (a.o !== s.player || sim.dom(a) !== 'air' || a.path.length || !a.c.fighter || np > 3) continue; np++; const P = w.regions[a.r]; const x = sx(P.x), y = sy(P.y); if (x < -120 || y < -120 || x > W + 120 || y > H + 120) continue;
      const rr = 30 + z * 9, an = now * 0.9 + a.id; const px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr * 0.55; const vs = Math.round(spx * 0.9 * D); const sp = vehicle('fighter', vs);
      g.save(); g.globalAlpha = 0.3; g.filter = 'brightness(0)'; g.translate(px + 9, py + 12); g.rotate(an + Math.PI / 2); g.drawImage(sp, -vs / D / 2, -vs / D / 2, vs / D, vs / D); g.restore();
      g.save(); g.translate(px, py); g.rotate(an + Math.PI / 2); g.drawImage(sp, -vs / D / 2, -vs / D / 2, vs / D, vs / D); g.restore(); } }
    // ---- strikes in flight: sprite + shadow + red translucent path ----
    const visAt = (x: number, y: number) => { let best = -1, bd = 1e9; for (let i = 0; i < w.regions.length; i++) { const d = (w.regions[i].x - x) ** 2 + (w.regions[i].y - y) ** 2; if (d < bd) { bd = d; best = i; } } return best >= 0 && V[best] > 0; };
    const sams: [number, number, number, number][] = []; s.regions.forEach((R, i) => { if (R.b.samsite) sams.push([w.regions[i].x, w.regions[i].y, AIR_DEF_R, R.o]); }); for (const a of s.armies) if (a.c.sam) sams.push([w.regions[a.r].x, w.regions[a.r].y, AIR_DEF_R * 0.8, a.o]);
    const offscreen: [number, number][] = [];
    for (const k of s.strikes) { const T = w.regions[k.back ? k.home : k.target]; const mine = k.o === s.player;
      if (k.scout && !k.back && k.prog >= k.dist) { if (!mine && !V[k.target]) continue; const x = sx(T.x), y = sy(T.y), rr = RECON_R * z; if (mine) { g.fillStyle = 'rgba(150,215,255,0.16)'; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); g.strokeStyle = 'rgba(220,240,255,0.7)'; g.setLineDash([6, 5]); g.lineDashOffset = -now * 20; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]); }
        let j = 0; for (const u of Object.keys(k.c)) { const an = now * 1.1 + j * 2.4 + k.id; const px = x + Math.cos(an) * 34, py = y + Math.sin(an) * 20 - 12; const vs = Math.round(spx * 0.9 * D); const sp = vehicle(u as UKey, vs); g.save(); g.globalAlpha = 0.3; g.filter = 'brightness(0)'; g.translate(px + 8, py + 10); g.rotate(an + 1.57); g.drawImage(sp, -vs / D / 2, -vs / D / 2, vs / D, vs / D); g.restore(); g.save(); g.translate(px, py); g.rotate(an + 1.57); g.drawImage(sp, -vs / D / 2, -vs / D / 2, vs / D, vs / D); g.restore(); j++; } continue; }
      const f = Math.min(1, (k.prog + k.spd * frac) / k.dist); const X0 = k.x0, Y0 = k.y0, X1 = T.x, Y1 = T.y; const lift = Math.hypot(X1 - X0, Y1 - Y0) * (k.m.ballistic ? 0.5 : 0.15);
      const bx = (u: number) => (1 - u) * (1 - u) * X0 + 2 * (1 - u) * u * (X0 + X1) / 2 + u * u * X1, by = (u: number) => (1 - u) * (1 - u) * Y0 + 2 * (1 - u) * u * ((Y0 + Y1) / 2 - lift) + u * u * Y1;
      const wxp = bx(f), wyp = by(f); if (!mine && !(s.regions[k.target].o === s.player && !k.back) && !visAt(wxp, wyp)) continue;
      if (!this.seenStrikes.has(k.id)) { this.seenStrikes.add(k.id); if (!mine && !k.back && s.regions[k.target].o === s.player && this.onThreat) this.onThreat(k.target); }
      const px = sx(wxp), py = sy(wyp); if (!mine && !k.back && s.regions[k.target].o === s.player && (px < 0 || py < 0 || px > W || py > H)) offscreen.push([px, py]);
      const hd = Math.atan2(by(Math.min(1, f + 0.01)) - wyp, bx(Math.min(1, f + 0.01)) - wxp);
      { const tot = Object.values(k.c).reduce((a: number, b: any) => a + b, 0) + Object.values(k.m).reduce((a: number, b: any) => a + (b || 0), 0); const top = (Object.keys(k.c)[0] || 'missile') as any; const bx = px + 14, by = py - spx * 1.1;
        g.strokeStyle = 'rgba(20,20,20,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, by + 18); g.lineTo(px + 4, py - 6); g.stroke(); g.drawImage(flag(k.o, Math.round(24 * D)), bx, by - 14, 24, 16);
        g.font = '900 12px system-ui'; const lb = String(tot); const bw = 28 + g.measureText(lb).width; const host = !mine; g.fillStyle = mine ? '#3fa52a' : host ? '#c0352b' : '#77868f'; g.fillRect(bx, by + 2, bw, 19); g.strokeStyle = this.selArmy === k.id ? '#ffe680' : '#fff'; g.lineWidth = 1.3; g.strokeRect(bx, by + 2, bw, 19);
        glyph(g, top, bx + 11, by + 11.5, 15); g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(lb, bx + 22, by + 16.5); g.textAlign = 'center'; if (mine) this.armyPos.set(k.id, [bx + bw / 2, by + 10]); }
      if (mine) { if (!this.armyPos.has(k.id)) this.armyPos.set(k.id, [px, py]); if (this.selArmy === k.id) { g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(px, py, spx * (0.75 + 0.08 * Math.sin(now * 5)), 0, 7); g.stroke(); } }
      if (!k.back) { g.strokeStyle = mine ? 'rgba(200,40,30,0.38)' : 'rgba(220,40,30,0.5)'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); for (let u = f; u <= 1.001; u += 0.04) { const qx = sx(bx(u)), qy = sy(by(u)); u === f ? g.moveTo(qx, qy) : g.lineTo(qx, qy); } g.stroke(); g.lineCap = 'butt'; }
      const parts: [string, number][] = []; for (const u of Object.keys(k.c)) parts.push([u, (k.c as any)[u]]); for (const m of Object.keys(k.m)) parts.push([m === 'ballistic' ? 'ballistic' : 'missile', (k.m as any)[m]]);
      parts.slice(0, 3).forEach(([kind, cnt], j) => { const u = Math.max(0, f - j * 0.025); const qx = sx(bx(u)), qy = sy(by(u)); const vs = Math.round(spx * (kind === 'bomber' ? 1.3 : kind === 'missile' || kind === 'ballistic' ? 0.8 : 1.05) * D); const sp = vehicle(kind as any, vs); const lift2 = 14;
        g.save(); g.globalAlpha = 0.32; g.filter = 'brightness(0)'; g.translate(qx + 10, qy + lift2); g.rotate(hd); g.drawImage(sp, -vs / D / 2, -vs / D / 2, vs / D, vs / D); g.restore();
        g.save(); g.translate(qx, qy); g.rotate(hd); g.drawImage(sp, -vs / D / 2, -vs / D / 2, vs / D, vs / D); g.restore();
        this.emit(qx - Math.cos(hd) * vs / D * 0.45, qy - Math.sin(hd) * vs / D * 0.45, 'smoke', kind === 'missile' || kind === 'ballistic' ? 1.2 : 0.7, kind === 'missile' || kind === 'ballistic' ? 3 : 1.6);
        if (cnt > 1) { g.font = '900 11px system-ui'; g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText('×' + cnt, qx + 20, qy - 12); g.fillStyle = '#fff'; g.fillText('×' + cnt, qx + 20, qy - 12); } });
      if (!k.back) for (const [dx, dy, dr, own] of sams) { if (own === k.o || Math.hypot(dx - wxp, dy - wyp) > dr) continue; const qx = sx(dx), qy = sy(dy); g.strokeStyle = `rgba(255,60,40,${0.5 + 0.5 * Math.sin(now * 18)})`; g.lineWidth = 2; g.beginPath(); g.moveTo(qx, qy); g.lineTo(px, py); g.stroke(); const b2 = 15 + Math.sin(now * 9) * 3; g.strokeRect(px - b2, py - b2, b2 * 2, b2 * 2); g.font = '900 9px system-ui'; g.fillStyle = '#ff3c28'; g.fillText('LOCK', px, py - b2 - 3); break; } }
    for (const [px, py] of offscreen.slice(0, 6)) { const cx = Math.max(24, Math.min(W - 24, px)), cy = Math.max(150, Math.min(H - 140, py)); const an = Math.atan2(py - cy, px - cx); g.save(); g.translate(cx, cy); g.rotate(an); g.fillStyle = `rgba(230,50,40,${0.6 + 0.4 * Math.sin(now * 10)})`; g.beginPath(); g.moveTo(14, 0); g.lineTo(-8, -9); g.lineTo(-8, 9); g.closePath(); g.fill(); g.restore(); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; g.font = '900 10px system-ui'; g.strokeText('INCOMING', cx, cy + 20); g.fillText('INCOMING', cx, cy + 20); }
    if (this.prevV && this.prevV.length === V.length) { let nfl = 0; for (let i = 0; i < V.length && nfl < 8; i++) if (V[i] && !this.prevV[i]) { const x = sx(w.regions[i].x), y = sy(w.regions[i].y); if (x > -20 && y > -20 && x < W + 20 && y < H + 20) { this.emit(x, y, 'reveal', 1.2, 30); nfl++; } } } this.prevV = V.slice();
    for (const fx of s.fx) { if (this.seenFx.has(fx)) continue; this.seenFx.add(fx); const x = sx(fx.x), y = sy(fx.y);
      if (fx.k === 'boom') { this.emit(x, y, 'flash', 1, 24); for (let i = 0; i < 10; i++) this.emit(x, y, 'spark', 1, 2); for (let i = 0; i < 4; i++) this.emit(x, y, 'smoke', 2, 7); }
      else if (fx.k === 'intercept') { const ax = x + (Math.random() - 0.5) * 60, ay = y - 30 - Math.random() * 40; this.emit(ax, ay, 'flash', 0.8, 16); for (let i = 0; i < 8; i++) this.emit(ax, ay, 'spark', 0.8, 1.6); }
      else this.emit(x - 20, y - 20, 'spiral', 2.2, 1); }
    this.tickParticles(g, dt / 1000);
  }
  emit(x: number, y: number, k: Particle['k'], life: number, r: number) { if (this.parts.length > (this.cam.z < 1.5 ? 120 : 280)) return null; const a = Math.random() * 6.283, sp = k === 'spark' ? 40 + Math.random() * 80 : k === 'smoke' ? 5 : 0; const p: Particle = { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (k === 'smoke' ? 4 : 0), life, max: life, k, r, a: Math.random() * 6 }; this.parts.push(p); return p; }
  tickParticles(g: CanvasRenderingContext2D, dt: number) {
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; const f = Math.max(0, p.life / p.max);
      if (p.k === 'smoke') { g.fillStyle = `rgba(235,238,240,${0.4 * f})`; g.beginPath(); g.arc(p.x, p.y, p.r * (1.6 - f), 0, 7); g.fill(); }
      else if (p.k === 'spark') { p.vy += 60 * dt; g.fillStyle = `rgba(255,${200 * f + 40},60,${f})`; g.fillRect(p.x, p.y, 2.2, 2.2); }
      else if (p.k === 'flash') { const r = p.r * (1.4 - f); const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); gr.addColorStop(0, `rgba(255,250,210,${f})`); gr.addColorStop(0.4, `rgba(255,150,40,${0.8 * f})`); gr.addColorStop(1, 'rgba(255,60,20,0)'); g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill(); }
      else if (p.k === 'spiral') { p.a! += dt * 8; const rr = 18 * (1 - f) + 6; const x = p.x + Math.cos(p.a!) * rr, y = p.y + Math.sin(p.a!) * rr + (1 - f) * 40; const sp = vehicle('uav', 40); g.save(); g.globalAlpha = f; g.translate(x, y); g.rotate(p.a! + 1.57); g.drawImage(sp, -12, -12, 24, 24); g.restore(); g.fillStyle = `rgba(200,150,255,${f})`; g.font = '900 10px system-ui'; g.fillText('JAMMED', p.x, p.y - 26); }
      else { const r = p.r * (1.3 - f) + 6; g.strokeStyle = `rgba(255,255,255,${f})`; g.lineWidth = 2.5; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.stroke(); } }
    this.parts = this.parts.filter(p => p.life > 0); }
}
function spaced(g: CanvasRenderingContext2D, t: string, x: number, y: number, sp: number, stroke: boolean) { const wd = g.measureText(t).width + sp * (t.length - 1); let cx = x - wd / 2; g.textAlign = 'left'; for (const ch of t) { stroke ? g.strokeText(ch, cx, y) : g.fillText(ch, cx, y); cx += g.measureText(ch).width + sp; } g.textAlign = 'center'; }
