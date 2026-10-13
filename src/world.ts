// Deterministic world generation from the real Natural Earth base + seed/variation params.
// Pure TS (no DOM) so a server can regenerate the identical world from WorldParams.
import { Delaunay } from 'd3-delaunay';
export interface BaseData { w: number; h: number; countries: { code: string; name: string; pop: number; polys: number[][] }[]; cities: { n: string; c: number; x: number; y: number; pop: number; cap: number }[] }
export interface WorldParams { seed: number; extra: number; distortion: number } // distortion 0..100
export interface Nation0 { code: string; name: string; color: string; fictional: boolean; pop: number }
export interface Region { id: number; n: string; geo: number; nation: number; x: number; y: number; pop: number; cap: boolean; port: boolean; terrain: number; cell: number[] }
export interface Edge { a: number; b: number; len: number; land: boolean }
export interface World { params: WorldParams; w: number; h: number; nations: Nation0[]; geoPolys: number[][][]; geoRegions: number[][]; lakes: [number, number, number][]; regions: Region[]; edges: Edge[]; adj: { to: number; e: number }[][] }
export const TERRAIN = ['Plains', 'Forest', 'Hills', 'Mountains', 'Urban'];
export const TERRAIN_DEF = [0, 0.15, 0.25, 0.45, 0.3];

export function rng(seed: number) { let s = seed >>> 0; return () => { let t = (s = (s + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function pointInRing(x: number, y: number, r: number[]) { let c = false; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
const SYL = ['ar', 'vel', 'dor', 'ka', 'mir', 'tan', 'sol', 'rho', 'zen', 'qua', 'bel', 'nor', 'esh', 'val', 'ost', 'ira', 'lun', 'tor', 'ux', 'ava', 'kel', 'dra', 'sin', 'mar'];
const SUF = [' Republic', ' Federation', ' Union', 'ia', 'stan', ' Commonwealth', 'land', ' Free State'];

export function generateWorld(base: BaseData, p: WorldParams): World {
  const R = rng(p.seed * 7919 + 13); const d = Math.max(0, Math.min(100, p.distortion)) / 100;
  const ph1 = R() * 100, ph2 = R() * 100;
  const nations: Nation0[] = base.countries.map((c, i) => ({ code: c.code, name: c.name, color: color(i), fictional: false, pop: c.pop }));
  // per-country affine distortion + coastline noise
  const geoPolys: number[][][] = []; const tf: { cx: number; cy: number; s: number; dx: number; dy: number }[] = [];
  base.countries.forEach(c => {
    const big = c.polys.reduce((a, b) => b.length > a.length ? b : a); let cx = 0, cy = 0; for (let i = 0; i < big.length; i += 2) { cx += big[i]; cy += big[i + 1]; } cx /= big.length / 2; cy /= big.length / 2;
    const s = 1 + d * (R() - 0.45) * 0.7, ang = R() * Math.PI * 2, mag = d * R() * 55; const t = { cx, cy, s, dx: Math.cos(ang) * mag, dy: Math.sin(ang) * mag * 0.7 }; tf.push(t);
    geoPolys.push(c.polys.map(r => { const o: number[] = []; for (let i = 0; i < r.length; i += 2) { let x = cx + (r[i] - cx) * s + t.dx, y = cy + (r[i + 1] - cy) * s + t.dy;
      if (d > 0) { const n = d * 5; x += n * Math.sin(r[i + 1] * 0.21 + ph1) * Math.cos(r[i] * 0.13 + ph2); y += n * Math.cos(r[i] * 0.19 + ph2) * Math.sin(r[i + 1] * 0.11 + ph1); }
      o.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10); } return o; }));
  });
  // inland seas / new water bodies
  const lakes: [number, number, number][] = []; const nl = Math.floor(d * 9);
  for (let k = 0; k < nl; k++) { const ci = Math.floor(R() * base.countries.length); const r = geoPolys[ci].reduce((a, b) => b.length > a.length ? b : a); const vi = Math.floor(R() * (r.length / 2)) * 2; lakes.push([r[vi] + (R() - 0.5) * 30, r[vi + 1] + (R() - 0.5) * 30, 10 + d * 20 * R()]); }
  const bbox = geoPolys.map(ps => { let a = 1e9, b = 1e9, c = -1e9, e = -1e9; for (const r of ps) for (let i = 0; i < r.length; i += 2) { a = Math.min(a, r[i]); c = Math.max(c, r[i]); b = Math.min(b, r[i + 1]); e = Math.max(e, r[i + 1]); } return [a, b, c, e]; });
  const isLand = (x: number, y: number) => { for (const [lx, ly, lr] of lakes) if ((x - lx) ** 2 + (y - ly) ** 2 < lr * lr) return false; for (let i = 0; i < geoPolys.length; i++) { const b = bbox[i]; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue; if (geoPolys[i].some(r => pointInRing(x, y, r))) return true; } return false; };
  // regions from real cities, moved with their country
  const regions: Region[] = base.cities.map((c, i) => { const t = tf[c.c]; const x = Math.round((t.cx + (c.x - t.cx) * t.s + t.dx) * 10) / 10, y = Math.round((t.cy + (c.y - t.cy) * t.s + t.dy) * 10) / 10;
    const terr = c.pop > 2e6 ? 4 : Math.floor(R() * 4); return { id: i, n: c.n, geo: c.c, nation: c.c, x, y, pop: Math.round(c.pop * 1.35), cap: !!c.cap, port: false, terrain: terr, cell: [] }; });
  // Voronoi cells per geographic country (rendered clipped to the country shape)
  const geoRegions: number[][] = base.countries.map(() => []); regions.forEach(r => geoRegions[r.geo].push(r.id));
  geoRegions.forEach((ids, gi) => { const b = bbox[gi]; const pad = 4; const box: [number, number, number, number] = [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
    if (ids.length === 1) { regions[ids[0]].cell = [box[0], box[1], box[2], box[1], box[2], box[3], box[0], box[3]]; return; }
    const pts = ids.map(i => [regions[i].x + (i % 7) * 1e-3, regions[i].y] as [number, number]);
    const v = Delaunay.from(pts).voronoi(box); ids.forEach((id, k) => { const poly = v.cellPolygon(k); regions[id].cell = poly ? poly.flat().map(n => Math.round(n * 10) / 10) : []; }); });
  // road/sea graph from a global Delaunay triangulation
  const D = Delaunay.from(regions.map(r => [r.x, r.y] as [number, number])); const edges: Edge[] = []; const seen = new Set<number>();
  const tri = D.triangles; for (let t = 0; t < tri.length; t++) { const a = tri[t], b = tri[t % 3 === 2 ? t - 2 : t + 1]; const lo = Math.min(a, b), hi = Math.max(a, b); const key = lo * 100000 + hi; if (seen.has(key)) continue; seen.add(key);
    const A = regions[lo], B = regions[hi]; const len = Math.hypot(A.x - B.x, A.y - B.y); if (len > 130) continue;
    let land = true; for (let k = 1; k < 6; k++) { const f = k / 6; if (!isLand(A.x + (B.x - A.x) * f, A.y + (B.y - A.y) * f)) { land = false; break; } }
    if (!land && len > 75) continue; edges.push({ a: lo, b: hi, len: Math.round(len * 10) / 10, land }); }
  const adj: { to: number; e: number }[][] = regions.map(() => []); edges.forEach((e, i) => { adj[e.a].push({ to: e.b, e: i }); adj[e.b].push({ to: e.a, e: i }); });
  regions.forEach((r, i) => { if (adj[i].length) return; let best = -1, bd = 1e9; regions.forEach((q, j) => { if (j !== i) { const dd = Math.hypot(q.x - r.x, q.y - r.y); if (dd < bd) { bd = dd; best = j; } } }); if (best >= 0) { edges.push({ a: i, b: best, len: Math.round(bd), land: false }); adj[i].push({ to: best, e: edges.length - 1 }); adj[best].push({ to: i, e: edges.length - 1 }); } });
  regions.forEach((r, i) => { r.port = adj[i].some(a => !edges[a.e].land) || [0, 1, 2, 3, 4, 5].some(k => !isLand(r.x + Math.cos(k) * 14, r.y + Math.sin(k) * 14)); });
  // fictional countries carved out of existing ones
  for (let k = 0; k < Math.min(10, p.extra); k++) {
    const cand = regions.filter(r => !r.cap && !nations[r.nation].fictional && adj[r.id].some(a => edges[a.e].land)); if (!cand.length) break;
    const seed = cand[Math.floor(R() * cand.length)]; const nid = nations.length; const parent = seed.nation;
    const name = cap(SYL[Math.floor(R() * SYL.length)] + SYL[Math.floor(R() * SYL.length)]) + SUF[Math.floor(R() * SUF.length)];
    nations.push({ code: 'F' + k, name, color: color(nid + 37), fictional: true, pop: 0 });
    const want = 2 + Math.floor(R() * 4); const q = [seed.id]; const got: number[] = [];
    while (q.length && got.length < want) { const c = q.shift()!; if (got.includes(c) || regions[c].nation !== parent || regions[c].cap) continue; got.push(c); for (const a of adj[c]) if (edges[a.e].land) q.push(a.to); }
    got.forEach((id, j) => { regions[id].nation = nid; regions[id].cap = j === 0; nations[nid].pop += regions[id].pop; });
  }
  let h = 0; regions.forEach(r => h = Math.max(h, r.y)); geoPolys.forEach(ps => ps.forEach(r => { for (let i = 1; i < r.length; i += 2) h = Math.max(h, r[i]); }));
  return { params: p, w: base.w, h: Math.ceil(h + 30), nations, geoPolys, geoRegions, lakes, regions, edges, adj };
}
function cap(s: string) { return s[0].toUpperCase() + s.slice(1); }
function color(i: number) { const h = (i * 137.508) % 360; return `hsl(${h.toFixed(0)},${30 + (i % 3) * 8}%,${30 + (i % 4) * 5}%)`; }
