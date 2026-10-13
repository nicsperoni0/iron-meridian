import { Sim, UNITS, MapData } from './sim';
import { icon } from './icons';
export class Renderer {
  cv: HTMLCanvasElement; g: CanvasRenderingContext2D; map: MapData; paths: Path2D[]; bbox: number[][]; colors: string[];
  cam = { x: 0, y: 0, z: 1 }; dpr = Math.min(2, window.devicePixelRatio || 1); sel = -1; moveSrc = -1; selUnits: number[] = [];
  constructor(cv: HTMLCanvasElement, map: MapData) {
    this.cv = cv; this.g = cv.getContext('2d')!; this.map = map;
    this.paths = map.provinces.map(p => { const P = new Path2D(); for (const r of p.r) { P.moveTo(r[0], r[1]); for (let i = 2; i < r.length; i += 2) P.lineTo(r[i], r[i + 1]); P.closePath(); } return P; });
    this.bbox = map.provinces.map(p => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const r of p.r) for (let i = 0; i < r.length; i += 2) { a = Math.min(a, r[i]); c = Math.max(c, r[i]); b = Math.min(b, r[i + 1]); d = Math.max(d, r[i + 1]); } return [a, b, c, d]; });
    this.colors = map.countries.map((_, i) => { const h = (i * 137.508) % 360; return `hsl(${h},${18 + (i % 3) * 6}%,${26 + (i % 4) * 4}%)`; });
    this.resize();
  }
  resize() { this.cv.width = innerWidth * this.dpr; this.cv.height = innerHeight * this.dpr; this.cv.style.width = innerWidth + 'px'; this.cv.style.height = innerHeight + 'px'; }
  focus(p: number, z = 6) { const P = this.map.provinces[p]; this.cam.z = z; this.cam.x = P.x - innerWidth / 2 / z; this.cam.y = P.y - innerHeight / 2.6 / z; }
  toWorld(sx: number, sy: number) { return [sx / this.cam.z + this.cam.x, sy / this.cam.z + this.cam.y]; }
  pick(sx: number, sy: number) { this.g.setTransform(1, 0, 0, 1, 0, 0); const [x, y] = this.toWorld(sx, sy); for (let i = 0; i < this.paths.length; i++) { const b = this.bbox[i]; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue; if (this.g.isPointInPath(this.paths[i], x, y)) return i; } return -1; }
  draw(sim: Sim, frac: number) {
    const { g, cam, map } = this; const s = sim.s; const W = innerWidth, H = innerHeight;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0a1622'); bg.addColorStop(1, '#06101a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.setTransform(this.dpr * cam.z, 0, 0, this.dpr * cam.z, -cam.x * cam.z * this.dpr, -cam.y * cam.z * this.dpr);
    // grid
    g.strokeStyle = 'rgba(80,140,180,0.07)'; g.lineWidth = 1 / cam.z; g.beginPath(); for (let x = 0; x <= map.w; x += 50) { g.moveTo(x, 0); g.lineTo(x, map.h); } for (let y = 0; y <= map.h; y += 50) { g.moveTo(0, y); g.lineTo(map.w, y); } g.stroke();
    const vx0 = cam.x, vy0 = cam.y, vx1 = cam.x + W / cam.z, vy1 = cam.y + H / cam.z; const vis: number[] = [];
    for (let i = 0; i < this.paths.length; i++) { const b = this.bbox[i]; if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue; vis.push(i);
      const o = s.provs[i].o; g.fillStyle = o === s.player ? '#2f6b4f' : this.colors[o]; g.fill(this.paths[i]); }
    g.lineWidth = 0.6 / cam.z; g.strokeStyle = 'rgba(0,0,0,0.55)'; for (const i of vis) g.stroke(this.paths[i]);
    // national borders: stroke provinces whose owner differs from a neighbor (approximation, cheap)
    g.lineWidth = 1.3 / cam.z; for (const i of vis) { const o = s.provs[i].o; if (map.provinces[i].nb.some(j => s.provs[j].o !== o)) { g.strokeStyle = o === s.player ? 'rgba(120,255,190,0.55)' : 'rgba(10,10,10,0.6)'; g.stroke(this.paths[i]); } }
    if (this.sel >= 0) { g.lineWidth = 2.5 / cam.z; g.strokeStyle = '#ffd34d'; g.stroke(this.paths[this.sel]); g.fillStyle = 'rgba(255,211,77,0.12)'; g.fill(this.paths[this.sel]); }
    // labels & icons in screen space
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sx = (x: number) => (x - cam.x) * cam.z, sy = (y: number) => (y - cam.y) * cam.z;
    if (cam.z > 2.2) { g.font = '600 10px system-ui'; g.textAlign = 'center'; g.fillStyle = 'rgba(220,230,240,0.55)';
      for (const i of vis) { const p = map.provinces[i]; const sz = (this.bbox[i][2] - this.bbox[i][0]) * cam.z; if (sz > 70) g.fillText(p.n.toUpperCase(), sx(p.x), sy(p.y) + 22); } }
    const isz = Math.max(14, Math.min(30, 8 + cam.z * 3));
    for (const i of vis) { const P = s.provs[i]; const b = P.b; const p = map.provinces[i]; const mine = P.o === s.player;
      if (!b.city && !b.base && !b.outpost && !b.airfield && !b.port && !b.factory) continue;
      if (cam.z < 1.6 && !b.city) continue; if (cam.z < 0.9 && !mine && (b.city || 0) < 3) continue;
      const x = sx(p.x), y = sy(p.y);
      if (b.city) { const s2 = isz * 1.5; g.drawImage(icon('city', b.city, mine, Math.round(s2 * this.dpr)), x - s2 / 2, y - s2 / 2 - 4, s2, s2); }
      if (cam.z >= 1.6) { const sm = isz * 0.7; const row = (['base', 'airfield', 'port', 'factory', 'bunker', 'sam', 'artillery'] as const).filter(k => b[k]);
        row.forEach((k, j) => { const ix = x - (row.length * sm) / 2 + j * sm; g.drawImage(icon(k, b[k]!, mine, Math.round(sm * this.dpr)), ix, y + (b.city ? isz * 0.55 : -sm / 2), sm, sm); });
        if (b.outpost) { const so = isz; g.drawImage(icon('outpost', b.outpost, mine, Math.round(so * this.dpr)), x - so / 2, y - so / 2, so, so); }
        if (P.q) { g.fillStyle = '#ffd34d'; g.font = '700 9px system-ui'; g.textAlign = 'center'; g.fillText('⚒ ' + P.q.left, x, y - isz); } }
    }
    // units: group by (prov, owner, nextProv)
    const groups = new Map<string, { o: number; x: number; y: number; n: number; t: string; mov: boolean; hp: number; ids: number[] }>();
    for (const u of s.units) { const p = map.provinces[u.p]; let x = p.x, y = p.y; let mov = false;
      if (u.path.length) { const q = map.provinces[u.path[0]]; const d = Math.hypot(q.x - p.x, q.y - p.y) || 1; const f = Math.min(1, (u.prog + UNITS[u.t].spd * frac * (u.prog > 0 ? 1 : 0)) / d); x += (q.x - p.x) * f; y += (q.y - p.y) * f; mov = true; }
      if (x < vx0 - 5 || x > vx1 + 5 || y < vy0 - 5 || y > vy1 + 5) continue;
      const k = `${u.p}|${u.o}|${u.path[0] ?? -1}`; let G = groups.get(k); if (!G) groups.set(k, G = { o: u.o, x: 0, y: 0, n: 0, t: UNITS[u.t].short, mov, hp: 0, ids: [] }); if (G.t !== UNITS[u.t].short) G.t = 'MIX'; G.x += x; G.y += y; G.n++; G.hp += u.hp / UNITS[u.t].hp; G.ids.push(u.id); }
    for (const G of groups.values()) { const mine = G.o === s.player; if (cam.z < 1.3 && !mine) continue; const x = sx(G.x / G.n) + (mine ? -14 : 14), y = sy(G.y / G.n) - 16;
      const sel = G.ids.some(id => this.selUnits.includes(id));
      g.fillStyle = mine ? '#0e3a5c' : '#5a1e1e'; g.strokeStyle = sel ? '#ffd34d' : mine ? '#6cc4ff' : '#ff7a6a'; g.lineWidth = sel ? 2.5 : 1.5;
      g.beginPath(); g.roundRect(x - 15, y - 9, 30, 18, 3); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.font = '700 9px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${G.t}${G.n > 1 ? '×' + G.n : ''}`, x, y);
      g.fillStyle = '#3cff8f'; g.fillRect(x - 13, y + 6, 26 * (G.hp / G.n), 2); if (G.mov) { g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(x + 15, y - 9, 3, 0, 7); g.fill(); }
      g.textBaseline = 'alphabetic'; }
    // move-path preview
    if (this.selUnits.length) { const u = s.units.find(v => v.id === this.selUnits[0]); if (u && u.path.length) { g.strokeStyle = 'rgba(255,211,77,0.8)'; g.setLineDash([5, 4]); g.lineWidth = 2; g.beginPath(); let p = map.provinces[u.p]; g.moveTo(sx(p.x), sy(p.y)); for (const q of u.path) { p = map.provinces[q]; g.lineTo(sx(p.x), sy(p.y)); } g.stroke(); g.setLineDash([]); } }
    // combat flashes
    const fight = new Set<number>(); for (const u of s.units) if (s.provs[u.p].o !== u.o && !u.path.length || (s.provs[u.p].o !== u.o && (s.provs[u.p].g > 0))) fight.add(u.p);
    const t = performance.now() / 120; for (const p of fight) { const P = map.provinces[p]; const x = sx(P.x), y = sy(P.y); if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      g.strokeStyle = `rgba(255,${120 + 60 * Math.sin(t)},60,0.9)`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 12 + 4 * Math.sin(t + p), 0, 7); g.stroke(); g.font = '14px system-ui'; g.textAlign = 'center'; g.fillText('💥', x + 8 * Math.sin(t * 0.7 + p), y - 18); }
  }
}
