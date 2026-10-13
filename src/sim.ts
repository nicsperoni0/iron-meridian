// Deterministic, serializable, command-driven simulation (no DOM, no Math.random, no Date).
import { World, TERRAIN_DEF, rng } from './world';

export type Res = { money: number; manpower: number; tech: number };
export const RES_KEYS: (keyof Res)[] = ['money', 'manpower', 'tech'];
export type UKey = 'inf' | 'sf' | 'ifv' | 'tank' | 'art' | 'sam' | 'cuas' | 'ew' | 'launcher' | 'fighter' | 'bomber' | 'uav' | 'recon' | 'loiter' | 'ship' | 'awacs';
export type MKey = 'cruise' | 'ballistic';
export type BKey = 'barracks' | 'factory' | 'airfield' | 'port' | 'missile' | 'samsite' | 'ewstation' | 'defense' | 'stadium' | 'skyscraper' | 'bridge' | 'techcampus' | 'powerplant' | 'hospital';
export const BONUS: BKey[] = ['stadium', 'skyscraper', 'bridge', 'techcampus', 'powerplant', 'hospital'];
export type Focus = 'balanced' | 'armor' | 'air' | 'missiles' | 'defense';
export type Comp = Partial<Record<UKey, number>>;

export interface UDef { at: BKey; batch: number; name: string; dom: 'land' | 'air' | 'sea'; atk: number; hp: number; spd: number; pp: number; range?: number; strike?: number; desc: string }
export const UNITS: Record<UKey, UDef> = {
  inf:     { at: 'barracks', batch: 3, name: 'Infantry', dom: 'land', atk: 2, hp: 3, spd: 5, pp: 1, desc: 'Cheap, holds ground' },
  sf:      { at: 'barracks', batch: 1, name: 'Special Forces', dom: 'land', atk: 5, hp: 4, spd: 7, pp: 3, desc: 'Elite raiders, strong vs garrisons' },
  ifv:     { at: 'factory', batch: 2, name: 'Mechanized IFV', dom: 'land', atk: 3.5, hp: 5, spd: 7, pp: 2.5, desc: 'Fast, solid all-rounder' },
  tank:    { at: 'factory', batch: 1, name: 'Main Battle Tank', dom: 'land', atk: 7, hp: 9, spd: 6, pp: 5, desc: 'Breakthrough power' },
  art:     { at: 'factory', batch: 1, name: 'Artillery', dom: 'land', atk: 6, hp: 3, spd: 4.5, pp: 3.5, desc: 'Crushes defenses; GPS shells can be jammed' },
  sam:     { at: 'samsite', batch: 1, name: 'SAM Battery', dom: 'land', atk: 1, hp: 4, spd: 5, pp: 5, desc: 'Shoots down jets, bombers, cruise & ballistic missiles' },
  cuas:    { at: 'factory', batch: 1, name: 'C-UAS / Anti-Drone', dom: 'land', atk: 1, hp: 3, spd: 6, pp: 2.5, desc: 'Guns + lasers vs drones & loitering munitions' },
  ew:      { at: 'factory', batch: 1, name: 'EW Jammer', dom: 'land', atk: 0.5, hp: 3, spd: 6, pp: 4, desc: 'Jams drones, cruise missiles & GPS weapons nearby' },
  launcher:{ at: 'missile', batch: 1, name: 'Missile Launcher', dom: 'land', atk: 0.5, hp: 4, spd: 5, pp: 6, desc: 'Fires cruise & ballistic missiles from stock' },
  fighter: { at: 'airfield', batch: 1, name: 'Fighter Jet', dom: 'air', atk: 5, hp: 6, spd: 22, pp: 9, range: 420, strike: 4, desc: 'Air superiority: kills drones, bombers, cruise missiles' },
  bomber:  { at: 'airfield', batch: 1, name: 'Bomber', dom: 'air', atk: 4, hp: 10, spd: 15, pp: 14, range: 650, strike: 16, desc: 'Heavy strike, vulnerable to SAM + fighters' },
  uav:     { at: 'airfield', batch: 3, name: 'Attack Drone', dom: 'air', atk: 2, hp: 2, spd: 10, pp: 2.5, range: 360, strike: 4, desc: 'Cheap strikes; countered by C-UAS & EW' },
  recon:   { at: 'airfield', batch: 2, name: 'Recon Drone', dom: 'air', atk: 0, hp: 1, spd: 12, pp: 1.5, range: 420, strike: 0, desc: '+40% strike accuracy in its package' },
  loiter:  { at: 'airfield', batch: 4, name: 'Loitering Munition', dom: 'air', atk: 3, hp: 1, spd: 9, pp: 1.8, range: 240, strike: 6, desc: 'One-way kamikaze drone; jammable' },
  awacs:   { at: 'airfield', batch: 1, name: 'AWACS Radar Plane', dom: 'air', atk: 0, hp: 8, spd: 14, pp: 16, range: 0, strike: 0, desc: 'Huge radar: reveals enemy units in a wide radius around its airfield' },
  ship:    { at: 'port', batch: 1, name: 'Frigate', dom: 'sea', atk: 6, hp: 14, spd: 6, pp: 12, desc: 'Coastal combat between ports' },
};
export const MISSILES: Record<MKey, { batch: number; name: string; range: number; spd: number; dmg: number; pp: number }> = {
  cruise: { batch: 2, name: 'Cruise Missile', range: 520, spd: 18, dmg: 9, pp: 4 },
  ballistic: { batch: 1, name: 'Ballistic Missile', range: 950, spd: 45, dmg: 14, pp: 8 },
};
export const BUILDINGS: Record<BKey, { name: string; max: number; time: number; cost: (l: number) => Partial<Res>; desc: string }> = {
  barracks:  { name: 'Barracks', max: 1, time: 8, cost: () => ({ money: 350 }), desc: 'Trains infantry & special forces' },
  factory:   { name: 'Factory', max: 1, time: 14, cost: () => ({ money: 800, tech: 60 }), desc: 'Builds IFVs, tanks, artillery, jammers, mobile AA' },
  airfield:  { name: 'Airfield', max: 1, time: 14, cost: () => ({ money: 900, tech: 120 }), desc: 'Builds & hosts jets, bombers, drones' },
  port:      { name: 'Naval Port', max: 1, time: 14, cost: () => ({ money: 800 }), desc: 'Builds frigates (coastal cities)' },
  missile:   { name: 'Missile Site', max: 1, time: 16, cost: () => ({ money: 1000, tech: 160 }), desc: 'Builds launchers + cruise/ballistic missiles' },
  samsite:   { name: 'Air Defense Site', max: 3, time: 12, cost: l => ({ money: 600 * (l + 1), tech: 80 * (l + 1) }), desc: 'Builds SAM batteries; fixed air & missile defense (L2+ = ABM)' },
  ewstation: { name: 'EW Station', max: 3, time: 12, cost: l => ({ money: 500 * (l + 1), tech: 100 * (l + 1) }), desc: 'Area jamming bubble (drones, cruise, GPS weapons)' },
  stadium:    { name: 'Sports Stadium', max: 3, time: 12, cost: l => ({ money: 700 * (l + 1) }), desc: '+20%/lvl production speed in this city' },
  skyscraper: { name: 'Skyscraper', max: 3, time: 12, cost: l => ({ money: 800 * (l + 1), tech: 40 * (l + 1) }), desc: '+30%/lvl money (tax) from this city' },
  bridge:     { name: 'Bridge', max: 3, time: 10, cost: l => ({ money: 600 * (l + 1) }), desc: '+10%/lvl production, +30%/lvl speed on roads from here' },
  techcampus: { name: 'Tech Campus', max: 3, time: 12, cost: l => ({ money: 700 * (l + 1) }), desc: '+40%/lvl tech from this city' },
  powerplant: { name: 'Power Plant', max: 3, time: 12, cost: l => ({ money: 900 * (l + 1) }), desc: '+15%/lvl all income & +10%/lvl production here' },
  hospital:   { name: 'Hospital', max: 3, time: 10, cost: l => ({ money: 600 * (l + 1) }), desc: '+25%/lvl manpower, faster garrison recovery' },
  defense:   { name: 'Defense Position / Outpost', max: 3, time: 8, cost: l => ({ money: 300 * (l + 1), manpower: 50 }), desc: 'Bunkers & trenches: garrison + damage reduction' },
};
export const FOCUS: Record<Focus, { name: string; mix: Comp; missiles: number }> = {
  balanced: { name: 'Balanced', mix: { awacs: 0.4, sf: 2, inf: 30, ifv: 14, tank: 8, art: 7, sam: 3, cuas: 3, ew: 2, launcher: 1, fighter: 2, uav: 6, recon: 2, loiter: 4, bomber: 0.5, ship: 0.5 }, missiles: 1 },
  armor:    { name: 'Armored Push', mix: { inf: 20, ifv: 20, tank: 18, art: 10, sam: 2, cuas: 2, ew: 1, uav: 3, loiter: 2, recon: 1 }, missiles: 0.5 },
  air:      { name: 'Air Power', mix: { awacs: 1, inf: 15, ifv: 5, fighter: 8, bomber: 3, uav: 14, recon: 4, loiter: 8, sam: 2, cuas: 2, ew: 2 }, missiles: 0.5 },
  missiles: { name: 'Missiles & Strike', mix: { inf: 15, ifv: 5, launcher: 6, uav: 6, loiter: 10, recon: 3, ew: 3, sam: 2, cuas: 2 }, missiles: 3 },
  defense:  { name: 'Air Defense & EW', mix: { inf: 20, ifv: 6, sam: 10, cuas: 10, ew: 8, fighter: 4, art: 4 }, missiles: 0.5 },
};
export interface Army { id: number; o: number; r: number; c: Comp; path: number[]; prog: number }
export interface Strike { hover?: number; scout?: boolean; id: number; o: number; home: number; target: number; c: Comp; m: Partial<Record<MKey, number>>; x0: number; y0: number; prog: number; dist: number; spd: number; back?: boolean }
export interface Fx { t: number; x: number; y: number; k: 'boom' | 'intercept' | 'jam' }
export interface StrikeReport { tick: number; att: number; def: number; target: number; sent: string; shot: number; jammed: number; hits: number; dmg: number; text: string }
export interface Nation { res: Res; alive: boolean; ai: boolean; focus: Focus; antijam: number; pp: number; missiles: Record<MKey, number>; target: number; mp: number }
export interface RegionState { o: number; b: Partial<Record<BKey, number>>; q: { k: BKey; left: number } | null; g: number; pq: { u: UKey | MKey; left: number }[] }
export interface State { v: 2; tick: number; rng: number; player: number; nextId: number; world: World['params']; nations: Nation[]; regions: RegionState[]; roads: number[]; armies: Army[]; strikes: Strike[]; fx: Fx[]; reports: StrikeReport[]; events: { tick: number; text: string; r?: number }[]; over?: string }
export type Command = { type: 'stop'; nation: number; army: number } |
  { type: 'move'; nation: number; army: number; dest: number; frac?: number }
  | { type: 'strike'; nation: number; army: number; target: number; kinds: (UKey | MKey)[] }
  | { type: 'build'; nation: number; region: number; b: BKey }
  | { type: 'focus'; nation: number; focus: Focus }
  | { type: 'antijam'; nation: number }
  | { type: 'queue'; nation: number; region: number; u: UKey | MKey }
  | { type: 'scout'; nation: number; army: number; target: number }
  | { type: 'unqueue'; nation: number; region: number; i: number };

export const AWACS_R = 200, SF_R = 130, RECON_R = 110;
export const GRACE = 240, PLAYER_SHIELD = 600, EW_R = 90, AIR_DEF_R = 110;
export const ANTIJAM_COST = (l: number) => ({ money: 900 * (l + 1), tech: 250 * (l + 1) });
export const csum = (c: Comp) => Object.values(c).reduce((a, b) => a + (b || 0), 0);

export class Sim {
  w: World; s: State; R: () => number;
  constructor(w: World, s: State) { this.w = w; this.s = s; this.R = () => { const r = rng(this.s.rng)(); this.s.rng = (this.s.rng + 0x9E3779B9) >>> 0; return r; }; }
  static create(w: World, player: number): State {
    const s: State = { v: 2, tick: 0, rng: (w.params.seed * 31 + 7) >>> 0, player, nextId: 1, world: w.params, nations: [], regions: [], roads: [], armies: [], strikes: [], fx: [], reports: [], events: [] };
    s.roads = w.edges.map(e => !e.land ? 0 : w.regions[e.a].nation === w.regions[e.b].nation || (w.regions[e.a].pop > 1.5e6 && w.regions[e.b].pop > 1.5e6) ? 2 : 1);
    s.regions = w.regions.map(r => ({ o: r.nation, b: {}, q: null, g: 0, pq: [] }));
    const sim = new Sim(w, s);
    s.nations = w.nations.map((_, i) => ({ res: { money: 3000, manpower: 1500, tech: 600 }, alive: true, ai: i !== player, focus: 'balanced', antijam: 0, pp: 0, missiles: { cruise: 0, ballistic: 0 }, target: -1, mp: 1 }));
    w.nations.forEach((N, n) => {
      const mine = w.regions.filter(r => r.nation === n).sort((a, b) => (+b.cap - +a.cap) || b.pop - a.pop); if (!mine.length) { s.nations[n].alive = false; return; }
      const popM = Math.max(0.3, (N.pop || mine.reduce((a, r) => a + r.pop, 0)) / 1e6); const sz = Math.sqrt(popM);
      const cap = mine[0].id; const C = s.regions[cap].b; C.barracks = 1; C.defense = 1; if (popM > 3) C.factory = 1; if (popM > 2) C.airfield = 1; if (popM > 5) C.samsite = 1; if (popM > 25) C.missile = 1; if (popM > 40) C.ewstation = 1; if (popM > 10 && mine[0].port) C.port = 1;
      if (mine[1]) s.regions[mine[1].id].b.barracks = 1; if (mine[2] && popM > 30) s.regions[mine[2].id].b.factory = 1;
      s.nations[n].missiles = { cruise: popM > 25 ? 4 : 0, ballistic: popM > 50 ? 2 : 0 };
      // opening position: 15-50 pre-placed units
      const total = Math.round(Math.max(15, Math.min(50, 12 + sz * 3.5))); const spots = mine.slice(0, Math.min(5, mine.length)); let left = total;
      spots.forEach((r, k) => { const t = k === spots.length - 1 ? left : Math.round(total * (k === 0 ? 0.4 : 0.6 / Math.max(1, spots.length - 1))); left -= t; if (t <= 0) return;
        const c: Comp = { ifv: Math.round(t * 0.15), tank: Math.round(t * 0.12), art: Math.round(t * 0.08) }; c.inf = t - c.ifv! - c.tank! - c.art!; if (k === 0) { c.sam = popM > 5 ? 1 : 0; c.ew = popM > 20 ? 1 : 0; c.cuas = 1; c.launcher = C.missile ? 1 : 0; c.inf = Math.max(1, c.inf! - c.sam - c.ew - c.cuas - c.launcher); } sim.addArmy(n, r.id, c); });
      if (C.airfield) sim.addArmy(n, cap, { fighter: Math.max(1, Math.round(sz * 0.5)), uav: Math.max(2, Math.round(sz)), recon: 1, loiter: Math.round(sz * 0.8), bomber: popM > 60 ? 1 : 0 });
      mine.forEach(r => s.regions[r.id].g = sim.maxG(r.id));
    });
    s.events.push({ tick: 0, text: `You command ${w.nations[player].name}. Your armies are deployed. Grace period: ~5 min.` });
    return s;
  }
  addArmy(o: number, r: number, c: Comp) { for (const k of Object.keys(c) as UKey[]) if (!c[k]) delete c[k]; if (!csum(c)) return null;
    const idle = this.s.armies.find(a => a.o === o && a.r === r && !a.path.length && this.dom(a) === this.domC(c));
    if (idle) { for (const k of Object.keys(c) as UKey[]) idle.c[k] = (idle.c[k] || 0) + c[k]!; return idle; }
    const a: Army = { id: this.s.nextId++, o, r, c: { ...c }, path: [], prog: 0 }; this.s.armies.push(a); return a; }
  domC(c: Comp) { const k = Object.keys(c)[0] as UKey; return k ? UNITS[k].dom : 'land'; }
  dom(a: Army) { return this.domC(a.c); }
  maxG(r: number) { const b = this.s.regions[r].b; const reg = this.w.regions[r]; return Math.round(10 + Math.sqrt(reg.pop / 1e4) * 0.8 + (b.defense || 0) * 20 + (b.barracks ? 8 : 0)); }
  defMult(r: number) { const b = this.s.regions[r].b; const reg = this.w.regions[r]; return 1 + (b.defense || 0) * 0.3 + TERRAIN_DEF[reg.terrain] + (reg.cap ? 0.15 : 0); }
  income(n: number): Res { const r: Res = { money: 0, manpower: 0, tech: 0 }; this.s.regions.forEach((R, i) => { if (R.o !== n) return; const p = Math.sqrt(this.w.regions[i].pop / 1e4); const b = R.b, pw = 1 + (b.powerplant || 0) * 0.15; r.money += (4 + p * 1.6) * pw * (1 + (b.skyscraper || 0) * 0.3); r.manpower += (1 + p * 0.8) * pw * (1 + (b.hospital || 0) * 0.25); r.tech += (0.5 + p * 0.35) * pw * (1 + (b.techcampus || 0) * 0.4); });
    const m = this.s.nations[n].ai ? 0.6 : 1; for (const k of RES_KEYS) r[k] = Math.round(r[k] * m * 10) / 10; return r; }
  canAfford(n: number, c: Partial<Res>) { const r = this.s.nations[n].res; return RES_KEYS.every(k => r[k] >= (c[k] || 0)); }
  pay(n: number, c: Partial<Res>) { const r = this.s.nations[n].res; for (const k of RES_KEYS) r[k] -= c[k] || 0; }
  dist(a: number, b: number) { const A = this.w.regions[a], B = this.w.regions[b]; return Math.hypot(A.x - B.x, A.y - B.y); }
  buildCheck(n: number, r: number, k: BKey): string | null { const R = this.s.regions[r]; if (R.o !== n) return 'Not your region'; if (R.q) return 'Already building'; const l = R.b[k] || 0; if (l >= BUILDINGS[k].max) return 'Max level'; if (!this.canAfford(n, BUILDINGS[k].cost(l))) return 'Not enough resources'; return null; }
  unitCap(n: number) { let p = 0; this.s.regions.forEach((R, i) => { if (R.o === n) p += this.w.regions[i].pop; }); return Math.round(Math.max(40, Math.min(400, 30 + Math.sqrt(p / 1e6) * 18))); }
  unitCount(n: number) { let c = 0; for (const a of this.s.armies) if (a.o === n) c += csum(a.c); for (const k of this.s.strikes) if (k.o === n) c += csum(k.c); this.s.regions.forEach(R => { if (R.o === n) for (const q of R.pq) if (q.u in UNITS) c += UNITS[q.u as UKey].batch; }); return c; }
  unitCost(u: UKey | MKey): Partial<Res> { if (u === 'cruise' || u === 'ballistic') { const p = MISSILES[u].pp * MISSILES[u].batch; return { money: p * 45, tech: p * 10 }; } const d = UNITS[u]; const p = d.pp * d.batch; return { money: Math.round(p * 40), manpower: d.dom === 'land' ? Math.round(p * 8) : Math.round(p * 2), tech: d.dom === 'air' || u === 'ew' || u === 'sam' || u === 'launcher' ? Math.round(p * 6) : 0 }; }
  unitTime(u: UKey | MKey) { return u === 'cruise' || u === 'ballistic' ? 10 : Math.round(4 + UNITS[u].pp * UNITS[u].batch * 1.5); }
  producer(u: UKey | MKey): BKey { return u === 'cruise' || u === 'ballistic' ? 'missile' : UNITS[u].at; }
  queueCheck(n: number, r: number, u: UKey | MKey): string | null { const R = this.s.regions[r]; if (R.o !== n) return 'Not your region'; const b = this.producer(u); if (!R.b[b]) return `Needs ${BUILDINGS[b].name}`;
    if (R.pq.length >= 6) return 'Queue full'; if (u in UNITS && this.unitCount(n) + UNITS[u as UKey].batch > this.unitCap(n)) return `Unit cap reached (${this.unitCap(n)})`; if (!this.canAfford(n, this.unitCost(u))) return 'Not enough resources'; return null; }
  path(from: number, to: number, dom: string): number[] { const N = this.w.regions.length; const prev = new Int32Array(N).fill(-1); prev[from] = from; const q = [from];
    for (let h = 0; h < q.length; h++) { const c = q[h]; if (c === to) break; for (const a of this.w.adj[c]) { if (prev[a.to] >= 0) continue; const e = this.w.edges[a.e];
      if (dom === 'sea' && (e.land || !this.w.regions[a.to].port)) continue; prev[a.to] = c; q.push(a.to); } }
    if (prev[to] < 0) return []; const out: number[] = []; for (let c = to; c !== from; c = prev[c]) out.push(c); return out.reverse(); }
  edgeBetween(a: number, b: number) { const x = this.w.adj[a].find(v => v.to === b); return x ? x.e : -1; }
  // ---- strike planning helpers (also used by UI to preview the rock-paper-scissors) ----
  airDefense(def: number, target: number) { let sam = 0, cuas = 0, ew = 0, ftr = 0; const T = this.w.regions[target];
    for (const a of this.s.armies) { if (a.o !== def) continue; const d = this.dist(a.r, target); if (d > AIR_DEF_R * 2.5) continue;
      if (d <= AIR_DEF_R) { const f = a.r === target ? 1 : 0.5; sam += (a.c.sam || 0) * f; cuas += (a.c.cuas || 0) * f; }
      if (d <= EW_R) ew += (a.c.ew || 0) * (a.r === target ? 1 : 0.6); if (!a.path.length) ftr += (a.c.fighter || 0) * (d <= AIR_DEF_R * 2.5 ? 1 : 0); }
    this.s.regions.forEach((R, i) => { if (R.o !== def) return; const W = this.w.regions[i]; const d = Math.hypot(W.x - T.x, W.y - T.y); if (d <= AIR_DEF_R) { sam += (R.b.samsite || 0) * 8 * (i === target ? 1 : 0.6); } if (d <= EW_R) ew += (R.b.ewstation || 0) * 8 * (i === target ? 1 : 0.6); });
    const jam = ew / (ew + 12); return { sam, cuas, ew, ftr, jam, abm: this.s.regions[target].b.samsite && this.s.regions[target].b.samsite! >= 2 ? 2 : 1 }; }
  // ---------------- fog of war (deterministic, used by AI and UI) ----------------
  private vcache = new Map<number, { t: number; v: Uint8Array }>();
  /** 0 = hidden, 1 = detected (radar/adjacent), 2 = close look (own presence / drones overhead; reveals special forces) */
  vision(n: number): Uint8Array { const key = Math.floor(this.s.tick / 5); const c = this.vcache.get(n); if (c && c.t === key) return c.v;
    const s = this.s, w = this.w, V = new Uint8Array(w.regions.length); const set = (i: number, l: number) => { if (V[i] < l) V[i] = l; };
    const radius = (x: number, y: number, r: number, l: number) => { const r2 = r * r; for (let i = 0; i < w.regions.length; i++) { const R = w.regions[i]; if ((R.x - x) ** 2 + (R.y - y) ** 2 <= r2) set(i, l); } };
    s.regions.forEach((R, i) => { if (R.o !== n) return; set(i, 2); for (const a of w.adj[i]) set(a.to, 1); const b = R.b; const P = w.regions[i];
      if (b.samsite) radius(P.x, P.y, AIR_DEF_R, 1); else if (b.airfield || b.ewstation) radius(P.x, P.y, 70, 1); });
    for (const a of s.armies) { if (a.o !== n) continue; const P = w.regions[a.r]; set(a.r, 2); if (this.dom(a) !== 'air') { for (const x of w.adj[a.r]) set(x.to, 1); if (a.path.length) set(a.path[0], 1); }
      if (a.c.sf) radius(P.x, P.y, SF_R, 1); if (a.c.sam) radius(P.x, P.y, AIR_DEF_R * 0.8, 1); if (a.c.awacs && !a.path.length) radius(P.x, P.y, AWACS_R, 1); }
    for (const k of s.strikes) if (k.o === n && k.scout && (k.hover || 0) > 0 && k.prog >= k.dist) { const T = w.regions[k.target]; radius(T.x, T.y, RECON_R, 2); }
    this.vcache.set(n, { t: key, v: V }); return V; }
  /** Can nation n see army a? Special-forces-only stacks need a close look. */
  seen(n: number, a: Army, V = this.vision(n)) { if (a.o === n) return true; const l = V[a.r]; const sfOnly = Object.keys(a.c).every(k => k === 'sf'); return sfOnly ? l >= 2 : l >= 1; }
  seenRegion(n: number, r: number) { return this.s.regions[r].o === n || this.vision(n)[r] > 0; }
  apply(cmd: Command): string | null { const s = this.s, n = cmd.nation, N = s.nations[n]; if (!N?.alive) return 'Eliminated';
    switch (cmd.type) {
      case 'build': { const e = this.buildCheck(n, cmd.region, cmd.b); if (e) return e; const R = s.regions[cmd.region]; this.pay(n, BUILDINGS[cmd.b].cost(R.b[cmd.b] || 0)); R.q = { k: cmd.b, left: BUILDINGS[cmd.b].time }; return null; }
      case 'focus': N.focus = cmd.focus; return null;
      case 'antijam': { if (N.antijam >= 3) return 'Max level'; const c = ANTIJAM_COST(N.antijam); if (!this.canAfford(n, c)) return 'Not enough resources'; this.pay(n, c); N.antijam++; if (n === s.player) this.log(`GPS anti-jam / EW protection upgraded to L${N.antijam}`); return null; }
      case 'scout': { const a = s.armies.find(x => x.id === cmd.army); if (!a || a.o !== n) return 'Invalid'; const d = this.dist(a.r, cmd.target); const c: Comp = {};
        for (const k of ['recon', 'uav'] as UKey[]) if (a.c[k] && d <= (UNITS[k].range || 0)) { c[k] = a.c[k]; delete a.c[k]; } if (!csum(c)) return 'Needs recon/attack drones in range';
        if (!csum(a.c)) s.armies = s.armies.filter(x => x !== a); const A = this.w.regions[a.r]; s.strikes.push({ id: s.nextId++, o: n, home: a.r, target: cmd.target, c, m: {}, x0: A.x, y0: A.y, prog: 0, dist: d, spd: 11, hover: 40, scout: true }); return null; }
      case 'queue': { const e = this.queueCheck(n, cmd.region, cmd.u); if (e) return e; this.pay(n, this.unitCost(cmd.u)); s.regions[cmd.region].pq.push({ u: cmd.u, left: this.unitTime(cmd.u) }); return null; }
      case 'unqueue': { const R = s.regions[cmd.region]; if (R.o !== n || !R.pq[cmd.i]) return 'Invalid'; const q = R.pq.splice(cmd.i, 1)[0]; const c = this.unitCost(q.u); for (const k of RES_KEYS) N.res[k] += (c[k] || 0) * 0.8; return null; }
      case 'stop': { const a = s.armies.find(x => x.id === cmd.army); if (!a || a.o !== n) return 'Invalid army'; a.path = a.path.slice(0, 1); return null; }
      case 'move': { const a = s.armies.find(x => x.id === cmd.army); if (!a || a.o !== n || a.r === cmd.dest) return 'Invalid army'; const dom = this.dom(a);
        if (dom === 'air') { if (!s.regions[cmd.dest].b.airfield || s.regions[cmd.dest].o !== n) return 'Aircraft rebase to your airfields only'; if (this.dist(a.r, cmd.dest) > 700) return 'Out of range'; a.r = cmd.dest; this.merge(a); return null; }
        const p = this.path(a.r, cmd.dest, dom); if (!p.length) return 'No route'; let mv = a;
        if (cmd.frac && cmd.frac < 1) { const c: Comp = {}; for (const k of Object.keys(a.c) as UKey[]) { const t = Math.floor(a.c[k]! * cmd.frac); if (t) { c[k] = t; a.c[k]! -= t; } } if (!csum(c)) return 'Army too small'; mv = { id: s.nextId++, o: n, r: a.r, c, path: [], prog: 0 }; s.armies.push(mv); }
        mv.path = p; mv.prog = 0; return null; }
      case 'strike': { const a = s.armies.find(x => x.id === cmd.army); if (!a || a.o !== n) return 'Invalid'; if (s.regions[cmd.target].o === n) return 'Pick an enemy region';
        const d = this.dist(a.r, cmd.target); const c: Comp = {}; const m: Partial<Record<MKey, number>> = {}; let spd = 99;
        for (const k of cmd.kinds) { if (k === 'cruise' || k === 'ballistic') { const L = a.c.launcher || 0; const cnt = Math.min(N.missiles[k], Math.max(0, L * 3)); if (!cnt || d > MISSILES[k].range) continue; m[k] = cnt; N.missiles[k] -= cnt; spd = Math.min(spd, MISSILES[k].spd); }
          else { const u = UNITS[k as UKey]; const cnt = a.c[k as UKey] || 0; if (!cnt || u.dom !== 'air' || d > (u.range || 0)) continue; c[k as UKey] = cnt; delete a.c[k as UKey]; spd = Math.min(spd, u.spd); } }
        if (!csum(c) && !csum(m as Comp)) return 'Nothing in range can strike'; if (!csum(a.c)) s.armies = s.armies.filter(x => x !== a);
        const A = this.w.regions[a.r]; s.strikes.push({ id: s.nextId++, o: n, home: a.r, target: cmd.target, c, m, x0: A.x, y0: A.y, prog: 0, dist: d, spd });
        if (N.target < 0 || N.ai) N.target = s.regions[cmd.target].o; return null; }
    } }
  merge(a: Army) { const o = this.s.armies.find(x => x !== a && x.o === a.o && x.r === a.r && !x.path.length && this.dom(x) === this.dom(a)); if (o) { for (const k of Object.keys(a.c) as UKey[]) o.c[k] = (o.c[k] || 0) + a.c[k]!; this.s.armies = this.s.armies.filter(x => x !== a); } }
  log(text: string, r?: number) { this.s.events.push({ tick: this.s.tick, text, r }); if (this.s.events.length > 50) this.s.events.splice(0, this.s.events.length - 50); }
  step(cmds: Command[] = []) {
    const s = this.s; if (s.over) return; for (const c of cmds) this.apply(c); s.tick++;
    s.nations.forEach((N, n) => { if (!N.alive) return; const inc = this.income(n); for (const k of RES_KEYS) N.res[k] = Math.round((N.res[k] + inc[k]) * 10) / 10; });
    s.regions.forEach((R, i) => { if (R.q && --R.q.left <= 0) { const k = R.q.k; R.b[k] = (R.b[k] || 0) + 1; R.q = null; if (k === 'defense') R.g = this.maxG(i); if (R.o === s.player) this.log(`${BUILDINGS[k].name} ready in ${this.w.regions[i].n}`, i); } });
    s.regions.forEach((R, i) => { const q = R.pq[0]; if (!q) return; if (!R.b[this.producer(q.u)]) { R.pq = []; return; } q.left -= 1 + (R.b.stadium || 0) * 0.2 + (R.b.bridge || 0) * 0.1 + (R.b.powerplant || 0) * 0.1; if (q.left > 0) return; R.pq.shift();
      if (q.u === 'cruise' || q.u === 'ballistic') s.nations[R.o].missiles[q.u] += MISSILES[q.u].batch; else this.addArmy(R.o, i, { [q.u]: UNITS[q.u].batch });
      if (R.o === s.player) this.log(`${q.u in UNITS ? UNITS[q.u as UKey].name : MISSILES[q.u as MKey].name} ×${q.u in UNITS ? UNITS[q.u as UKey].batch : MISSILES[q.u as MKey].batch} ready in ${this.w.regions[i].n}`, i); });
    this.move(); this.strikes(); this.combat();
    this.ai();
    if (s.tick % 20 === 0) this.roadsGrow();
    s.regions.forEach((R, i) => { const mg = this.maxG(i); if (R.g < mg) R.g = Math.min(mg, R.g + (0.5 + mg * 0.01) * (1 + (R.b.hospital || 0) * 0.5)); });
    s.fx = s.fx.filter(f => s.tick - f.t < 4);
    if (s.tick % 10 === 0) { const alive = new Set(s.regions.map(r => r.o)); s.nations.forEach((N, n) => { if (N.alive && !alive.has(n)) { N.alive = false; s.armies = s.armies.filter(a => a.o !== n); this.log(`${this.w.nations[n].name} has been eliminated`); } });
      if (!s.nations[s.player].alive) s.over = 'defeat'; else if (s.nations.filter(N => N.alive).length === 1) s.over = 'victory'; }
  }
  move() { const s = this.s;
    for (const a of s.armies) { if (!a.path.length) continue; const R = s.regions[a.r];
      if (R.o !== a.o && (R.g > 0 || s.armies.some(b => b.r === a.r && b.o !== a.o && this.dom(b) !== 'air'))) continue; // pinned in battle
      const next = a.path[0]; const e = this.edgeBetween(a.r, next); if (e < 0) { a.path = []; continue; }
      const road = s.roads[e]; let spd = Math.min(...(Object.keys(a.c) as UKey[]).map(k => UNITS[k].spd)); if (this.dom(a) === 'land') spd *= (road === 2 ? 1.6 : road === 1 ? 0.8 : 0.4) * (road ? 1 + 0.3 * Math.max(s.regions[a.r].b.bridge || 0, s.regions[next].b.bridge || 0) : 1);
      a.prog += spd; if (a.prog >= this.w.edges[e].len) { a.r = next; a.path.shift(); a.prog = 0; if (!a.path.length) this.merge(a); } } }
  roadsGrow() { const s = this.s; let grown = 0; this.w.edges.forEach((e, i) => { if (s.roads[i] === 1 && s.regions[e.a].o === s.regions[e.b].o && grown < 6) { s.roads[i] = 2; grown++; if (s.regions[e.a].o === s.player) this.log(`Road extended: ${this.w.regions[e.a].n} – ${this.w.regions[e.b].n}`, e.b); } }); }
  strikes() { const s = this.s; const done: Strike[] = [];
    for (const k of s.strikes) { if (k.scout && !k.back && k.prog >= k.dist) { k.hover = (k.hover || 0) - 1; const AD = this.airDefense(s.regions[k.target].o, k.target);
        if (this.R() < Math.min(0.25, AD.cuas * 0.01 + AD.jam * 0.08)) { const ks = Object.keys(k.c) as UKey[]; const u = ks[Math.floor(this.R() * ks.length)]; k.c[u]!--; if (!k.c[u]) delete k.c[u]; const T = this.w.regions[k.target]; s.fx.push({ t: s.tick, x: T.x, y: T.y, k: 'intercept' }); }
        if (!csum(k.c)) { done.push(k); continue; } if (k.hover! <= 0) { done.push(k); const T = this.w.regions[k.target]; s.strikes.push({ ...k, id: s.nextId++, x0: T.x, y0: T.y, prog: 0, back: true, scout: false, hover: 0, dist: this.dist(k.target, k.home) }); } continue; }
      k.prog += k.spd; if (k.prog < k.dist) continue; if (k.scout && !k.back) continue; done.push(k); if (k.back) { const home = s.regions[k.home].o === k.o && s.regions[k.home].b.airfield ? k.home : s.regions.findIndex(R => R.o === k.o && R.b.airfield); if (home >= 0) this.addArmy(k.o, home, k.c); continue; } this.resolveStrike(k); }
    if (done.length) s.strikes = s.strikes.filter(k => !done.includes(k)); }
  resolveStrike(k: Strike) { const s = this.s, T = this.w.regions[k.target], def = s.regions[k.target].o; const AD = this.airDefense(def, k.target); const aj = s.nations[k.o].antijam;
    const jam = AD.jam * (1 - 0.28 * aj); let shot = 0, jammed = 0, hits = 0, dmg = 0; const back: Comp = {}; const parts: string[] = [];
    const roll = (n: number, p: number) => { const e = n * p; const f = Math.floor(e); return Math.min(n, f + (this.R() < e - f ? 1 : 0)); };
    const escort = k.c.fighter || 0; const ftrNet = Math.max(0, AD.ftr - escort);
    const recon = (k.c.recon || 0) > 0 ? 1.4 : 1;
    for (const u of Object.keys(k.c) as UKey[]) { const n = k.c[u]!; parts.push(`${n} ${UNITS[u].name}`); let pk = 0, pj = 0;
      if (u === 'fighter' || u === 'bomber') { pk = AD.sam / (AD.sam + 25) + (u === 'bomber' ? ftrNet / (ftrNet + 15) * 0.6 : 0); pj = 0; }
      else { pk = (AD.cuas * 1.2 + AD.sam * 0.25 + AD.ftr * 0.2) / (AD.cuas * 1.2 + AD.sam * 0.25 + AD.ftr * 0.2 + 14); pj = jam; }
      pk = Math.min(0.92, pk); const dead = roll(n, pk); const jm = roll(n - dead, pj); const ok = n - dead - jm; shot += dead; jammed += jm; hits += ok;
      const acc = (u === 'bomber' ? 1 - jam * 0.3 : 1) * recon; dmg += ok * (UNITS[u].strike || 0) * acc;
      if (u !== 'loiter') { const surv = n - dead; if (surv) back[u] = surv; } }
    for (const m of Object.keys(k.m) as MKey[]) { const n = k.m[m]!; parts.push(`${n} ${MISSILES[m].name}`);
      const pk = m === 'cruise' ? Math.min(0.9, (AD.sam * 0.8 + AD.ftr * 0.3) / (AD.sam * 0.8 + AD.ftr * 0.3 + 18)) : Math.min(0.85, AD.sam * 0.4 * AD.abm / (AD.sam * 0.4 * AD.abm + 35));
      const dead = roll(n, pk); const jm = m === 'cruise' ? roll(n - dead, jam * 0.8) : 0; const ok = n - dead - jm; shot += dead; jammed += jm; hits += ok; dmg += ok * MISSILES[m].dmg * recon; }
    // apply damage: fixed defenses first take a share (SEAD), then armies, then garrison
    const R = s.regions[k.target]; if (dmg > 40) { for (const b of ['samsite', 'ewstation', 'airfield', 'missile'] as BKey[]) if (R.b[b] && this.R() < dmg / 400) { R.b[b]!--; if (!R.b[b]) delete R.b[b]; } }
    let left = dmg; const armies = s.armies.filter(a => a.r === k.target && a.o === def && !a.path.length);
    for (const a of armies) { left = this.damage(a, left * 0.85) + left * 0.15; if (left <= 0) break; } R.g = Math.max(0, R.g - left * 0.5);
    s.armies = s.armies.filter(a => csum(a.c) > 0);
    for (let i = 0; i < Math.min(6, shot); i++) s.fx.push({ t: s.tick, x: T.x + (this.R() - 0.5) * 30, y: T.y + (this.R() - 0.5) * 30, k: 'intercept' });
    for (let i = 0; i < Math.min(5, jammed); i++) s.fx.push({ t: s.tick, x: T.x + (this.R() - 0.5) * 40, y: T.y + (this.R() - 0.5) * 40, k: 'jam' });
    for (let i = 0; i < Math.min(8, hits); i++) s.fx.push({ t: s.tick, x: T.x + (this.R() - 0.5) * 16, y: T.y + (this.R() - 0.5) * 16, k: 'boom' });
    const text = `Strike on ${T.n}: ${shot} shot down, ${jammed} jammed, ${hits} hit (${Math.round(dmg)} dmg)`;
    s.reports.push({ tick: s.tick, att: k.o, def, target: k.target, sent: parts.join(', '), shot, jammed, hits, dmg: Math.round(dmg), text }); if (s.reports.length > 20) s.reports.shift();
    if (k.o === s.player) this.log('🎯 ' + text, k.target); else if (def === s.player) this.log(`🚨 ${this.w.nations[k.o].name} ${text.toLowerCase()}`, k.target);
    if (csum(back)) s.strikes.push({ ...k, id: s.nextId++, c: back, m: {}, x0: T.x, y0: T.y, prog: 0, back: true, dist: this.dist(k.target, k.home) });
    if (def !== k.o) { const D = s.nations[def]; if (D.ai && D.target < 0) D.target = k.o; } }
  damage(a: Army, d: number) { // remove units, cheapest first-ish proportional; returns leftover damage
    const keys = (Object.keys(a.c) as UKey[]); const tot = csum(a.c); if (!tot) return d;
    for (const k of keys) { const share = d * (a.c[k]! / tot); const kill = share / UNITS[k].hp; const n = Math.floor(kill) + (this.R() < kill % 1 ? 1 : 0); a.c[k] = Math.max(0, a.c[k]! - n); if (!a.c[k]) delete a.c[k]; }
    return 0; }
  combat() { const s = this.s; const by = new Map<number, Army[]>();
    for (const a of s.armies) { if (this.dom(a) === 'air') continue; let l = by.get(a.r); if (!l) by.set(a.r, l = []); l.push(a); }
    for (const [r, as] of by) { const R = s.regions[r]; const owners = [...new Set(as.map(a => a.o))]; const inv = as.filter(a => a.o !== R.o); if (!inv.length && owners.length < 2) continue;
      const power = new Map<number, number>(); const jamBy = new Map<number, number>();
      for (const a of as) { let p = 0; for (const k of Object.keys(a.c) as UKey[]) p += a.c[k]! * UNITS[k].atk; power.set(a.o, (power.get(a.o) || 0) + p); jamBy.set(a.o, (jamBy.get(a.o) || 0) + (a.c.ew || 0)); }
      const dm = this.defMult(r);
      for (const a of as) { let incoming = 0; for (const [o, p] of power) if (o !== a.o) { let pp = p; const art = as.filter(b => b.o === o).reduce((x, b) => x + (b.c.art || 0) * UNITS.art.atk, 0); const myJam = jamBy.get(a.o) || 0; const jf = myJam / (myJam + 10) * (1 - 0.28 * s.nations[o].antijam); pp -= art * jf * 0.5; incoming += pp; }
        if (a.o !== R.o) incoming += R.g * 0.25 + (R.b.defense || 0) * 6; const share = csum(a.c) / Math.max(1, as.filter(b => b.o === a.o).reduce((x, b) => x + csum(b.c), 0));
        const red = a.o === R.o ? dm : 1; this.damage(a, incoming * share * 0.05 * (0.85 + this.R() * 0.3) / red); }
      // attackers grind down the garrison
      for (const [o, p] of power) if (o !== R.o) { const art = as.filter(b => b.o === o).reduce((x, b) => x + (b.c.art || 0), 0); R.g = Math.max(0, R.g - (p * 0.03 + art * 0.6) / dm); }
      s.armies = s.armies.filter(a => csum(a.c) > 0);
      const left = s.armies.filter(a => a.r === r && this.dom(a) !== 'air'); const defenders = left.some(a => a.o === R.o);
      if (!defenders && R.g <= 0) { const att = left.find(a => a.o !== R.o && this.dom(a) === 'land'); if (att) this.capture(r, att.o); }
      else if (R.o === s.player && inv.length && s.tick % 20 === 0) this.log(`⚔ ${this.w.nations[inv[0].o].name} is attacking ${this.w.regions[r].n}`, r);
    } }
  capture(r: number, nw: number) { const s = this.s, R = s.regions[r]; const old = R.o; R.o = nw; R.q = null; R.pq = []; R.g = 5; if (R.b.defense) R.b.defense = Math.max(0, R.b.defense - 1) || undefined as any; if (R.b.samsite) R.b.samsite--; if (R.b.ewstation) R.b.ewstation--; for (const k of Object.keys(R.b) as BKey[]) if (!R.b[k]) delete R.b[k];
    // enemy aircraft parked here flee to the nearest friendly airfield or are lost
    for (const a of s.armies) if (a.r === r && a.o === old) { const af = s.regions.findIndex(Q => Q.o === old && Q.b.airfield); if (af >= 0 && this.dom(a) === 'air') a.r = af; else a.c = {}; }
    s.armies = s.armies.filter(a => csum(a.c) > 0);
    const nm = this.w.regions[r].n; if (nw === s.player) this.log(`🏴 Captured ${nm}!`, r); else if (old === s.player) this.log(`⚠ ${this.w.nations[nw].name} captured ${nm}`, r);
    if (s.nations[old].ai) s.nations[old].target = nw; }
  // ------------------------------- AI -------------------------------
  ai() { const s = this.s; const slot = s.tick % 16; for (let n = 0; n < s.nations.length; n++) if (n % 16 === slot && s.nations[n].ai && s.nations[n].alive && s.tick % 32 < 16) this.aiNation(n); }
  aiNation(n: number) { const s = this.s, N = s.nations[n]; const mine: number[] = []; s.regions.forEach((R, i) => { if (R.o === n) mine.push(i); }); if (!mine.length) return;
    const isFront = (i: number) => this.w.adj[i].some(a => s.regions[a.to].o !== n);
    const front = mine.filter(isFront); const neighbors = new Set<number>(); for (const i of front) for (const a of this.w.adj[i]) if (s.regions[a.to].o !== n) neighbors.add(s.regions[a.to].o);
    const V = this.vision(n);
    // choose a war target: weakest neighbor (player only after shield)
    if (s.tick > GRACE && (N.target < 0 || !s.nations[N.target]?.alive || !neighbors.has(N.target)) && this.R() < 0.5) { let best = -1, bs = 1e9; for (const o of neighbors) { if (o === s.player && s.tick < PLAYER_SHIELD) continue; const str = s.armies.filter(a => a.o === o && this.seen(n, a, V)).reduce((x, a) => x + csum(a.c), 0); if (str < bs) { bs = str; best = o; } } N.target = best; }
    const enemyArmies = s.armies.filter(a => a.o === N.target && this.seen(n, a, V)); const enemyAir = enemyArmies.reduce((x, a) => x + (a.c.uav || 0) + (a.c.loiter || 0) + (a.c.bomber || 0), 0) + (N.target >= 0 ? s.nations[N.target].missiles.cruise : 0);
    const enemyEw = enemyArmies.reduce((x, a) => x + (a.c.ew || 0), 0);
    N.focus = enemyAir > 60 ? 'defense' : (n % 5 === 0 ? 'air' : n % 5 === 1 ? 'armor' : n % 7 === 2 ? 'missiles' : 'balanced');
    // buildings
    const tryB = (r: number, k: BKey) => !this.buildCheck(n, r, k) && !this.apply({ type: 'build', nation: n, region: r, b: k });
    const big = [...mine].sort((a, b) => this.w.regions[b].pop - this.w.regions[a].pop); const has = (k: BKey) => mine.some(i => s.regions[i].b[k]);
    if (big[0] !== undefined) { const c0 = big[0];
      if (!has('barracks')) tryB(c0, 'barracks'); else if (!has('factory') && s.tick > 60) tryB(c0, 'factory'); else if (!has('airfield') && s.tick > 150) tryB(c0, 'airfield');
      else if (enemyAir > 6 && (s.regions[c0].b.samsite || 0) < 2) tryB(c0, 'samsite'); else if (enemyAir > 10 && !s.regions[c0].b.ewstation) tryB(c0, 'ewstation');
      else if (!has('missile') && s.tick > 400 && mine.length > 4) tryB(c0, 'missile'); else if (big[1] !== undefined && !s.regions[big[1]].b.barracks) tryB(big[1], 'barracks');
      else if (!has('port') && s.tick > 300) { const pc = big.find(i => this.w.regions[i].port); if (pc !== undefined) tryB(pc, 'port'); } }
    if (front.length) { const f = front[Math.floor(this.R() * front.length)]; if ((s.regions[f].b.defense || 0) < 2) tryB(f, 'defense'); }
    if (N.res.money > 2500 && big.length) { const c = big[Math.floor(this.R() * Math.min(3, big.length))]; const k = BONUS[Math.floor(this.R() * BONUS.length)]; tryB(c, k); }
    if (enemyEw > 3 && N.antijam < 3 && this.canAfford(n, ANTIJAM_COST(N.antijam))) this.apply({ type: 'antijam', nation: n });
    // production queues following the focus mix
    const mix = Object.entries(FOCUS[N.focus].mix) as [UKey, number][]; const tot = mix.reduce((a, [, w]) => a + w, 0);
    for (let tries = 0; tries < 3; tries++) { let roll = this.R() * tot, u: UKey = 'inf'; for (const [k, w] of mix) { roll -= w; if (roll <= 0) { u = k; break; } }
      const at = mine.filter(i => s.regions[i].b[UNITS[u].at] && s.regions[i].pq.length < 2); if (!at.length) continue; const r = at[Math.floor(this.R() * at.length)]; if (!this.queueCheck(n, r, u)) this.apply({ type: 'queue', nation: n, region: r, u }); }
    const ms = mine.find(i => s.regions[i].b.missile && s.regions[i].pq.length < 2); if (ms !== undefined && N.missiles.cruise < 6) { const u: MKey = this.R() < 0.7 ? 'cruise' : 'ballistic'; if (!this.queueCheck(n, ms, u)) this.apply({ type: 'queue', nation: n, region: ms, u }); }
    // ground: interior armies march to the front, front armies attack weak targets
    const land = s.armies.filter(a => a.o === n && !a.path.length && this.dom(a) === 'land');
    for (const a of land) { if (!isFront(a.r)) { if (s.tick < 60) continue; if (csum(a.c) > 6 && front.length && this.R() < 0.5) { let best = front[0], bd = 1e9; for (const f of front) { const d = this.dist(a.r, f); if (d < bd) { bd = d; best = f; } } this.apply({ type: 'move', nation: n, army: a.id, dest: best, frac: 0.7 }); } continue; }
      if (s.tick < GRACE || N.target < 0) continue; let tgt = -1, ts = 1e9; for (const ad of this.w.adj[a.r]) { const R = s.regions[ad.to]; if (R.o !== N.target) continue; const dp = (V[ad.to] ? 0 : 30) + s.armies.filter(b => b.r === ad.to && b.o === R.o && this.seen(n, b, V)).reduce((x, b) => x + (Object.keys(b.c) as UKey[]).reduce((y, k) => y + b.c[k]! * UNITS[k].atk, 0), 0); const sc = (dp + R.g * 0.8) * this.defMult(ad.to); if (sc < ts) { ts = sc; tgt = ad.to; } }
      const myP = (Object.keys(a.c) as UKey[]).reduce((y, k) => y + a.c[k]! * UNITS[k].atk, 0); if (tgt >= 0 && myP * 0.75 > ts * 1.3) this.apply({ type: 'move', nation: n, army: a.id, dest: tgt, frac: 0.75 }); }
    // air & missiles: strike the biggest enemy concentration in range, avoid heavily defended targets with drones
    if (s.tick >= GRACE && N.target >= 0 && s.tick % 64 < 16) { const airA = s.armies.filter(a => a.o === n && !a.path.length && (this.dom(a) === 'air' || (a.c.launcher || 0) > 0));
      for (const a of airA) { let best = -1, bv = 0; for (const e of enemyArmies) { if (this.dom(e) === 'air' && !(s.regions[e.r].b.airfield)) continue; const d = this.dist(a.r, e.r); if (d > 500) continue; const AD = this.airDefense(N.target, e.r); const v = csum(e.c) / (1 + AD.cuas * 0.05 + AD.jam * 2); if (v > bv) { bv = v; best = e.r; } }
        if (best < 0) continue; const AD = this.airDefense(N.target, best); const kinds: (UKey | MKey)[] = [];
        if (AD.jam < 0.5 || N.antijam >= 2) kinds.push('uav', 'loiter', 'cruise'); if (AD.sam < 15) kinds.push('bomber'); kinds.push('ballistic', 'recon', 'fighter');
        this.apply({ type: 'strike', nation: n, army: a.id, target: best, kinds }); }
      const sc = s.armies.find(a => a.o === n && !a.path.length && (a.c.recon || 0) > 0); if (sc) { const hidden = mine.flatMap(i => this.w.adj[i].map(x => x.to)).filter(j => s.regions[j].o === N.target && V[j] < 2); if (hidden.length) this.apply({ type: 'scout', nation: n, army: sc.id, target: hidden[Math.floor(this.R() * hidden.length)] }); } }
  }
}
