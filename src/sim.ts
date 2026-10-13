// Deterministic, serializable simulation. No DOM, no Math.random, no Date.
// A server can import this module, feed it the same commands, and get the same state.
export interface MapData { w: number; h: number; countries: { code: string; name: string }[]; provinces: MapProv[] }
export interface MapProv { n: string; c: number; r: number[][]; x: number; y: number; a: number; nb: number[] }

export type Res = { money: number; supplies: number; fuel: number; manpower: number; electronics: number };
export const RES_KEYS: (keyof Res)[] = ['money', 'supplies', 'fuel', 'manpower', 'electronics'];
export type BKey = 'city' | 'base' | 'airfield' | 'port' | 'factory' | 'bunker' | 'sam' | 'artillery' | 'outpost';
export type UKey = 'infantry' | 'mech' | 'mbt' | 'artillery' | 'airdef' | 'drone' | 'fighter' | 'heli' | 'naval';

export const CITY_NAMES = ['', 'Village', 'Town', 'City', 'Metropolis'];
type Cost = Partial<Res>;
export interface BDef { name: string; max: number; time: number; cost: (lvl: number) => Cost; desc: string }
const sc = (c: Cost, m: number): Cost => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round((v as number) * m)]));
export const BUILDINGS: Record<BKey, BDef> = {
  base:     { name: 'Army Base', max: 1, time: 10, cost: () => ({ money: 300, supplies: 200 }), desc: 'Trains ground units. Cities can be founded here or next door.' },
  city:     { name: 'City', max: 4, time: 12, cost: l => sc({ money: 400, supplies: 300, manpower: 100 }, [1, 1, 1.8, 3, 5][l]), desc: 'Village → Town → City → Metropolis. More resources each level.' },
  factory:  { name: 'Factory', max: 3, time: 14, cost: l => sc({ money: 500, supplies: 300 }, 1 + l * 0.8), desc: 'Fuel + electronics. Unlocks armor and artillery.' },
  airfield: { name: 'Airfield', max: 1, time: 14, cost: () => ({ money: 600, fuel: 200, electronics: 100 }), desc: 'Builds drones, jets, helicopters.' },
  port:     { name: 'Naval Port', max: 1, time: 14, cost: () => ({ money: 600, supplies: 300 }), desc: 'Builds warships.' },
  bunker:   { name: 'Bunkers', max: 3, time: 8, cost: l => sc({ money: 250, supplies: 250 }, 1 + l), desc: 'Big garrison + damage reduction at this city.' },
  sam:      { name: 'Air Defense (SAM)', max: 3, time: 10, cost: l => sc({ money: 350, electronics: 120 }, 1 + l), desc: 'Shoots down enemy aircraft over this city.' },
  artillery:{ name: 'Artillery Battery', max: 3, time: 10, cost: l => sc({ money: 300, supplies: 150, fuel: 60 }, 1 + l), desc: 'Shells enemy ground units attacking this city.' },
  outpost:  { name: 'Combat Outpost', max: 2, time: 6, cost: l => sc({ money: 150, supplies: 150, manpower: 40 }, 1 + l), desc: 'Garrison in provinces around your cities.' },
};
export interface UDef { name: string; short: string; atk: number; def: number; hp: number; spd: number; dom: 'land' | 'air' | 'sea'; at: BKey; time: number; cost: Cost; vsAir?: number; vsFort?: number; needFactory?: boolean }
export const UNITS: Record<UKey, UDef> = {
  infantry: { name: 'Infantry', short: 'INF', atk: 3, def: 5, hp: 20, spd: 3, dom: 'land', at: 'base', time: 4, cost: { money: 80, supplies: 40, manpower: 30 } },
  mech:     { name: 'Mechanized', short: 'MEC', atk: 5, def: 5, hp: 28, spd: 4.5, dom: 'land', at: 'base', time: 6, cost: { money: 150, fuel: 40, manpower: 30 } },
  mbt:      { name: 'Main Battle Tank', short: 'MBT', atk: 9, def: 7, hp: 40, spd: 4, dom: 'land', at: 'base', time: 8, cost: { money: 260, fuel: 80, electronics: 30, manpower: 20 }, needFactory: true },
  artillery:{ name: 'Artillery', short: 'ART', atk: 7, def: 2, hp: 18, spd: 2.5, dom: 'land', at: 'base', time: 6, cost: { money: 180, supplies: 80, fuel: 30 }, vsFort: 2.2, needFactory: true },
  airdef:   { name: 'Mobile Air Defense', short: 'AD', atk: 2, def: 3, hp: 20, spd: 3, dom: 'land', at: 'base', time: 6, cost: { money: 170, electronics: 50 }, vsAir: 5 },
  drone:    { name: 'Attack Drone', short: 'UAV', atk: 5, def: 1, hp: 12, spd: 9, dom: 'air', at: 'airfield', time: 5, cost: { money: 140, electronics: 60 }, vsFort: 1.4 },
  fighter:  { name: 'Fighter Jet', short: 'JET', atk: 8, def: 4, hp: 25, spd: 15, dom: 'air', at: 'airfield', time: 9, cost: { money: 380, fuel: 120, electronics: 80 }, vsAir: 2.5 },
  heli:     { name: 'Attack Helicopter', short: 'HEL', atk: 7, def: 3, hp: 20, spd: 8, dom: 'air', at: 'airfield', time: 7, cost: { money: 260, fuel: 80, electronics: 40 } },
  naval:    { name: 'Frigate', short: 'NAV', atk: 8, def: 8, hp: 50, spd: 5, dom: 'sea', at: 'port', time: 10, cost: { money: 420, fuel: 120, electronics: 60 } },
};
export interface Prov { o: number; b: Partial<Record<BKey, number>>; q: { k: BKey; left: number } | null; tq: { u: UKey; left: number }[]; g: number }
export interface Unit { id: number; o: number; t: UKey; p: number; hp: number; path: number[]; prog: number }
export interface Nation { res: Res; alive: boolean; ai: boolean; stance: number }
export interface GameEvent { tick: number; text: string; prov?: number; nation?: number }
export interface State { v: 1; tick: number; rng: number; player: number; nextId: number; nations: Nation[]; provs: Prov[]; units: Unit[]; events: GameEvent[]; over?: string }

export type Command =
  | { type: 'build'; nation: number; prov: number; b: BKey }
  | { type: 'train'; nation: number; prov: number; u: UKey }
  | { type: 'move'; nation: number; units: number[]; dest: number };

export const GRACE = 240; // AI won't attack in the first ~2 min at 1x

export class Sim {
  map: MapData; s: State; dist: number[][];
  constructor(map: MapData, s: State) { this.map = map; this.s = s; this.dist = map.provinces.map(p => p.nb.map(j => Math.hypot(map.provinces[j].x - p.x, map.provinces[j].y - p.y))); }
  static create(map: MapData, player: number, seed = 12345): State {
    const provs: Prov[] = map.provinces.map(p => ({ o: p.c, b: {}, q: null, tq: [], g: 5 }));
    const nations: Nation[] = map.countries.map((_, i) => ({ res: { money: 1500, supplies: 1200, fuel: 600, manpower: 600, electronics: 300 }, alive: true, ai: i !== player, stance: 0 }));
    const s: State = { v: 1, tick: 0, rng: seed >>> 0, player, nextId: 1, nations, provs, units: [], events: [] };
    const sim = new Sim(map, s);
    // capitals: largest province of each country
    map.countries.forEach((_, c) => {
      let best = -1; map.provinces.forEach((p, i) => { if (p.c === c && (best < 0 || p.a > map.provinces[best].a)) best = i; });
      if (best < 0) return;
      const P = provs[best]; P.b.city = 2; P.b.base = 1; P.b.bunker = 1; P.g = sim.maxGarrison(best);
      for (let k = 0; k < 3; k++) sim.spawn(c, 'infantry', best);
      if (c === player) { sim.spawn(c, 'mech', best); sim.spawn(c, 'mbt', best); }
    });
    s.events.push({ tick: 0, text: `You command ${map.countries[player].name}. Build cities near your army bases and defend them!` });
    return s;
  }
  rand() { let t = (this.s.rng = (this.s.rng + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  spawn(o: number, t: UKey, p: number) { const u: Unit = { id: this.s.nextId++, o, t, p, hp: UNITS[t].hp, path: [], prog: 0 }; this.s.units.push(u); return u; }
  terrain(p: number) { return ((p * 2654435761) >>> 0) % 5 * 0.05; } // 0..0.2 defensive terrain bonus
  maxGarrison(p: number) { const b = this.s.provs[p].b; return 20 + (b.city || 0) * 15 + (b.bunker || 0) * 40 + (b.outpost || 0) * 25 + (b.artillery || 0) * 10 + (b.base ? 10 : 0); }
  protection(p: number) { const b = this.s.provs[p].b; return 1 + (b.bunker || 0) * 0.2 + (b.city || 0) * 0.05 + (b.outpost || 0) * 0.15 + this.terrain(p); }
  income(n: number): Res {
    const r: Res = { money: 0, supplies: 0, fuel: 0, manpower: 0, electronics: 0 };
    this.s.provs.forEach((P, i) => { if (P.o !== n) return; const c = P.b.city || 0; const cm = [0, 1, 2.2, 4, 7][c];
      r.money += 1.5 + cm * 6; r.supplies += 1.2 + cm * 4; r.manpower += 0.5 + cm * 2.5; r.fuel += 0.4 + (P.b.factory || 0) * 3 + cm; r.electronics += 0.2 + (P.b.factory || 0) * 2 + cm * 0.8; void i; });
    const m = this.s.nations[n].ai ? 0.45 : 1;
    for (const k of RES_KEYS) r[k] = Math.round(r[k] * m * 10) / 10;
    return r;
  }
  canAfford(n: number, c: Cost) { const r = this.s.nations[n].res; return RES_KEYS.every(k => (r[k] || 0) >= (c[k] || 0)); }
  pay(n: number, c: Cost) { const r = this.s.nations[n].res; for (const k of RES_KEYS) r[k] -= c[k] || 0; }
  hasNear(n: number, p: number, k: BKey) { const P = this.map.provinces[p]; return [p, ...P.nb].some(q => this.s.provs[q].o === n && (this.s.provs[q].b[k] || 0) > 0); }
  nationHas(n: number, k: BKey) { return this.s.provs.some(P => P.o === n && (P.b[k] || 0) > 0); }
  hostilePresent(p: number, n: number) { return this.s.units.some(u => u.p === p && u.o !== n && UNITS[u.t].dom !== 'air'); }
  /** Returns null if allowed, otherwise reason. */
  buildCheck(n: number, p: number, k: BKey): string | null {
    const P = this.s.provs[p]; if (P.o !== n) return 'Not your province'; if (P.q) return 'Already building here';
    const lvl = P.b[k] || 0; const d = BUILDINGS[k]; if (lvl >= d.max) return 'Max level';
    const city = P.b.city || 0;
    if (k === 'city' && !this.hasNear(n, p, 'base')) return 'Needs an Army Base here or next door';
    if (k === 'city' && P.b.outpost) return 'Province has an outpost';
    if ((k === 'bunker' || k === 'sam' || k === 'artillery') && !city) return 'Defenses go in cities';
    if (k === 'outpost' && city) return 'Outposts go around cities, not in them';
    if (k === 'outpost' && !this.hasNear(n, p, 'city')) return 'Must be next to one of your cities';
    if ((k === 'airfield' || k === 'port' || k === 'factory') && city < 2) return 'Needs a Town (city level 2+)';
    if (!this.canAfford(n, d.cost(lvl))) return 'Not enough resources';
    return null;
  }
  trainCheck(n: number, p: number, u: UKey): string | null {
    const P = this.s.provs[p]; const d = UNITS[u]; if (P.o !== n) return 'Not your province';
    if (!P.b[d.at]) return `Needs ${BUILDINGS[d.at].name}`; if (d.needFactory && !this.nationHas(n, 'factory')) return 'Needs a Factory';
    if (P.tq.length >= 5) return 'Queue full'; if (!this.canAfford(n, d.cost)) return 'Not enough resources'; return null;
  }
  path(from: number, to: number, dom: string): number[] {
    if (dom === 'air') { // straight hop list via BFS anyway (keeps it simple & deterministic)
    }
    const prev = new Int32Array(this.map.provinces.length).fill(-1); prev[from] = from; const q = [from];
    for (let h = 0; h < q.length; h++) { const c = q[h]; if (c === to) break; for (const nb of this.map.provinces[c].nb) if (prev[nb] < 0) { prev[nb] = c; q.push(nb); } }
    if (prev[to] < 0) return []; const out: number[] = []; for (let c = to; c !== from; c = prev[c]) out.push(c); return out.reverse();
  }
  apply(cmd: Command): string | null {
    const s = this.s; const n = cmd.nation; if (!s.nations[n]?.alive) return 'Nation eliminated';
    if (cmd.type === 'build') { const e = this.buildCheck(n, cmd.prov, cmd.b); if (e) return e; const P = s.provs[cmd.prov]; this.pay(n, BUILDINGS[cmd.b].cost(P.b[cmd.b] || 0)); P.q = { k: cmd.b, left: BUILDINGS[cmd.b].time }; return null; }
    if (cmd.type === 'train') { const e = this.trainCheck(n, cmd.prov, cmd.u); if (e) return e; this.pay(n, UNITS[cmd.u].cost); s.provs[cmd.prov].tq.push({ u: cmd.u, left: UNITS[cmd.u].time }); return null; }
    if (cmd.type === 'move') { let ok = 0; for (const id of cmd.units) { const u = s.units.find(x => x.id === id); if (!u || u.o !== n) continue; const pth = u.p === cmd.dest ? [] : this.path(u.p, cmd.dest, UNITS[u.t].dom); if (!pth.length && u.p !== cmd.dest) continue; u.path = pth; u.prog = 0; ok++; } return ok ? null : 'No route'; }
    return 'Unknown command';
  }
  log(text: string, prov?: number, nation?: number) { this.s.events.push({ tick: this.s.tick, text, prov, nation }); if (this.s.events.length > 60) this.s.events.splice(0, this.s.events.length - 60); }
  step(cmds: Command[] = []) {
    const s = this.s; if (s.over) return; for (const c of cmds) this.apply(c);
    s.tick++;
    // income
    s.nations.forEach((N, n) => { if (!N.alive) return; const inc = this.income(n); for (const k of RES_KEYS) N.res[k] = Math.round((N.res[k] + inc[k]) * 10) / 10; });
    // construction & training
    s.provs.forEach((P, i) => {
      if (P.q && --P.q.left <= 0) { const k = P.q.k; P.b[k] = (P.b[k] || 0) + 1; P.q = null; P.g = Math.min(this.maxGarrison(i), P.g + 20);
        if (P.o === s.player) this.log(k === 'city' ? `${CITY_NAMES[P.b.city!]} ready in ${this.map.provinces[i].n}` : `${BUILDINGS[k].name} complete in ${this.map.provinces[i].n}`, i, P.o); }
      if (P.tq.length && --P.tq[0].left <= 0) { const t = P.tq.shift()!; this.spawn(P.o, t.u, i); }
    });
    // movement
    for (const u of s.units) { if (!u.path.length) continue; const d = UNITS[u.t];
      if (d.dom !== 'air' && s.provs[u.p].o !== u.o && (s.provs[u.p].g > 0 || this.hostilePresent(u.p, u.o))) continue; // pinned
      u.prog += d.spd; const next = u.path[0]; const ix = this.map.provinces[u.p].nb.indexOf(next); const len = ix >= 0 ? this.dist[u.p][ix] : 1;
      if (u.prog >= len) { u.p = next; u.path.shift(); u.prog = 0; } }
    this.combat();
    if (s.tick % 2 === 0) this.ai();
    // garrison regen
    s.provs.forEach((P, i) => { const mg = this.maxGarrison(i); if (P.g < mg && !this.hostilePresent(i, P.o)) P.g = Math.min(mg, P.g + 1 + mg * 0.02); });
    // elimination / victory
    if (s.tick % 10 === 0) { const alive = new Set(s.provs.map(p => p.o)); s.nations.forEach((N, n) => { if (N.alive && !alive.has(n)) { N.alive = false; s.units = s.units.filter(u => u.o !== n); this.log(`${this.map.countries[n].name} has been eliminated`, undefined, n); } });
      if (!s.nations[s.player].alive) s.over = 'defeat'; }
  }
  combat() {
    const s = this.s; const by = new Map<number, Unit[]>();
    for (const u of s.units) { let a = by.get(u.p); if (!a) by.set(u.p, a = []); a.push(u); }
    const dead = new Set<number>();
    for (const [p, us] of by) {
      const P = s.provs[p]; const owners = new Set(us.map(u => u.o));
      const invaders = us.filter(u => u.o !== P.o);
      if (!invaders.length && owners.size < 2) continue;
      // damage each unit receives
      const dmg = new Map<number, number>();
      const hit = (targets: Unit[], amount: number) => { if (!targets.length || amount <= 0) return; const t = targets[Math.floor(this.rand() * targets.length)]; dmg.set(t.id, (dmg.get(t.id) || 0) + amount); };
      const prot = this.protection(p);
      for (const o of owners) {
        const mine = us.filter(u => u.o === o); const foes = us.filter(u => u.o !== o);
        for (const u of mine) { const d = UNITS[u.t]; const foesAir = foes.filter(f => UNITS[f.t].dom === 'air'); const foesSurf = foes.filter(f => UNITS[f.t].dom !== 'air');
          const r = 0.8 + this.rand() * 0.4; const base = d.atk * r * 0.35 * (u.hp / d.hp * 0.5 + 0.5);
          if (d.vsAir && foesAir.length) hit(foesAir, base * d.vsAir / 2);
          else if (foesSurf.length) hit(foesSurf, base); else if (foesAir.length && d.dom === 'air') hit(foesAir, base);
          else if (o !== P.o && P.g > 0 && d.dom !== 'sea') P.g = Math.max(0, P.g - base * (d.vsFort || 1));
        }
      }
      // fixed defenses fire on invaders
      const invLand = invaders.filter(u => UNITS[u.t].dom !== 'air'); const invAir = invaders.filter(u => UNITS[u.t].dom === 'air');
      if (P.b.sam) for (let k = 0; k < P.b.sam; k++) hit(invAir, 4 * (0.7 + this.rand() * 0.6));
      if (P.b.artillery) for (let k = 0; k < P.b.artillery; k++) hit(invLand, 3 * (0.7 + this.rand() * 0.6));
      if (P.g > 0) { hit(invLand, 1.5 + P.g * 0.06); if (P.g > 40) hit(invLand, P.g * 0.04); }
      for (const u of us) { const d = dmg.get(u.id); if (!d) continue; const def = UNITS[u.t].def; const red = u.o === P.o ? prot : 1; u.hp -= d / red * (6 / (6 + def)); if (u.hp <= 0) dead.add(u.id); }
      // capture
      const defendersAlive = us.some(u => u.o === P.o && !dead.has(u.id) && UNITS[u.t].dom !== 'air');
      if (!defendersAlive && P.g <= 0) {
        const cand = invLand.filter(u => !dead.has(u.id) && UNITS[u.t].dom === 'land'); if (cand.length) {
          const nw = cand[0].o; const old = P.o; P.o = nw; P.q = null; P.tq = []; if (P.b.city && P.b.city > 1) P.b.city--; for (const k of ['bunker', 'sam', 'artillery', 'outpost'] as BKey[]) if (P.b[k]) P.b[k] = Math.floor(P.b[k]! / 2) || undefined as any;
          for (const k of Object.keys(P.b) as BKey[]) if (!P.b[k]) delete P.b[k];
          P.g = 8; const nm = this.map.provinces[p].n;
          if (nw === s.player) this.log(`Captured ${nm}!`, p, nw); else if (old === s.player) this.log(`⚠ ${this.map.countries[nw].name} captured ${nm}`, p, nw);
        }
      } else if (P.o === s.player && invaders.length && s.tick % 20 === 0) this.log(`⚠ ${nameOr(this, invaders[0].o)} is attacking ${this.map.provinces[p].n}`, p, invaders[0].o);
    }
    if (dead.size) s.units = s.units.filter(u => !dead.has(u.id));
  }
  // ---------------- AI ----------------
  ai() {
    const s = this.s; const N = s.nations.length; const slot = (s.tick / 2) % 12;
    for (let n = 0; n < N; n++) { if (n % 12 !== slot || !s.nations[n].ai || !s.nations[n].alive) continue; this.aiNation(n); }
  }
  aiNation(n: number) {
    const s = this.s; const mine: number[] = []; s.provs.forEach((P, i) => { if (P.o === n) mine.push(i); });
    if (!mine.length) return;
    const cities = mine.filter(i => s.provs[i].b.city); const army = s.units.filter(u => u.o === n);
    const tryB = (p: number, k: BKey) => !this.buildCheck(n, p, k) && !this.apply({ type: 'build', nation: n, prov: p, b: k });
    // economy & defense
    for (const c of cities) { const b = s.provs[c].b; const threatened = mine.some(i => this.map.provinces[i].nb.some(j => s.provs[j].o !== n));
      if ((b.city || 0) < 2 + Math.floor(s.tick / 600) && tryB(c, 'city')) break;
      if (threatened && (b.bunker || 0) < 1 + Math.floor(s.tick / 900) && tryB(c, 'bunker')) break;
      if (s.tick > 400 && !b.factory && tryB(c, 'factory')) break;
      if (s.tick > 600 && (b.sam || 0) < 1 && tryB(c, 'sam')) break;
      if (s.tick > 800 && (b.artillery || 0) < 1 && tryB(c, 'artillery')) break; }
    if (cities.length < 1 + Math.floor(s.tick / 500) && cities.length < 6) { const cand = mine.find(i => !s.provs[i].b.city && !s.provs[i].b.outpost && this.hasNear(n, i, 'base')); if (cand !== undefined) tryB(cand, 'city'); }
    // military
    const cap = Math.min(24, 3 + cities.length * 2 + Math.floor(s.tick / 240));
    if (army.length < cap) { const bases = mine.filter(i => s.provs[i].b.base); const opts: UKey[] = this.nationHas(n, 'factory') ? ['infantry', 'mech', 'mbt', 'artillery', 'mech'] : ['infantry', 'mech', 'infantry'];
      if (bases.length) { const b = bases[Math.floor(this.rand() * bases.length)]; const u = opts[Math.floor(this.rand() * opts.length)]; if (!this.trainCheck(n, b, u)) this.apply({ type: 'train', nation: n, prov: b, u }); } }
    if (s.tick < GRACE) return;
    // attack: pick weakest bordering foreign province, send an idle stack that outguns it
    const idle = army.filter(u => !u.path.length && UNITS[u.t].dom === 'land' && s.provs[u.p].o === n);
    if (idle.length < 4) return;
    const front = new Set<number>(); for (const i of mine) for (const j of this.map.provinces[i].nb) if (s.provs[j].o !== n) front.add(j);
    let best = -1, bestScore = 1e9;
    for (const j of front) { const P = s.provs[j]; const defU = s.units.filter(u => u.p === j && u.o === P.o).reduce((a, u) => a + UNITS[u.t].def * u.hp / 10, 0);
      const score = P.g * this.protection(j) + defU * 2 - (P.b.city || 0) * 15 + (P.o === s.player && s.tick < 600 ? 1e6 : 0); if (score < bestScore) { bestScore = score; best = j; } }
    if (best < 0) return;
    const power = idle.reduce((a, u) => a + UNITS[u.t].atk * (UNITS[u.t].vsFort || 1), 0) * 6;
    if (power < bestScore * 1.6 || this.rand() > 0.4) return;
    // keep 1 unit home per city
    const near = idle.filter(u => { const pt = this.path(u.p, best, 'land'); return pt.length > 0 && pt.length <= 4 && pt.slice(0, -1).every(q => s.provs[q].o === n); });
    if (near.length < 3) return;
    const send = near.slice(cities.length ? 1 : 0, 12);
    this.apply({ type: 'move', nation: n, units: send.map(u => u.id), dest: best });
  }
}
function nameOr(sim: Sim, n: number) { return sim.map.countries[n]?.name ?? 'Enemy'; }
