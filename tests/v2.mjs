import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:8787/';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e)));
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
await p.goto(URL); await p.waitForSelector('.nation');
const G = (fn, a) => p.evaluate(fn, a);
// --- world generation determinism at 0% and 100% ---
const gen = await G(() => { const g = window.__game, base = g.base(); const sig = w => JSON.stringify([w.regions.map(r => [r.x, r.y, r.nation]), w.edges.length, w.lakes]);
  const a0 = g.generateWorld(base, { seed: 42, extra: 0, distortion: 0 }), b0 = g.generateWorld(base, { seed: 42, extra: 0, distortion: 0 }), c0 = g.generateWorld(base, { seed: 99, extra: 0, distortion: 0 });
  const a1 = g.generateWorld(base, { seed: 42, extra: 10, distortion: 100 }), b1 = g.generateWorld(base, { seed: 42, extra: 10, distortion: 100 });
  const moved = a1.regions.reduce((s, r, i) => s + Math.hypot(r.x - a0.regions[i].x, r.y - a0.regions[i].y), 0) / a1.regions.length;
  const real = a0.regions.every((r, i) => r.x === base.cities[i].x && r.y === base.cities[i].y);
  return { det0: sig(a0) === sig(b0), seedIndep0: sig(a0) === sig(c0), det1: sig(a1) === sig(b1), moved, real, fict: a1.nations.filter(n => n.fictional).length, fictRegions: a1.regions.filter(r => a1.nations[r.nation].fictional).length, lakes1: a1.lakes.length, lakes0: a0.lakes.length, regions: a0.regions.length, roads0: a0.edges.filter(e => e.land).length }; });
console.log(JSON.stringify(gen));
ok(gen.det0 && gen.det1, 'world gen deterministic from seed (0% and 100%)'); ok(gen.real && gen.lakes0 === 0 && gen.seedIndep0, '0% distortion = real-world positions'); ok(gen.moved > 10 && gen.lakes1 > 0, `100% distortion shifts countries (avg ${gen.moved.toFixed(1)}px) and adds seas`); ok(gen.fict === 10 && gen.fictRegions >= 20, '10 fictional nations carved in');
await G(() => window.__game.setParams({ seed: 2026, extra: 4, distortion: 40 })); await p.waitForTimeout(400);
await p.screenshot({ path: 'screenshots/v2-new-game-generation.png' });
await G(() => window.__game.setParams({ seed: 2026, extra: 0, distortion: 0 })); await p.waitForTimeout(300);
await p.fill('#search', 'Turkey'); await p.click('.nation'); await p.waitForTimeout(1200);
const st0 = await G(() => { const s = window.__game.sim.s; const t = s.armies.filter(a => a.o === s.player).reduce((x, a) => x + Object.values(a.c).reduce((p, q) => p + q, 0), 0); return { troops: t, armies: s.armies.length, total: s.armies.reduce((x, a) => x + Object.values(a.c).reduce((p, q) => p + q, 0), 0), roads: s.roads.filter(r => r === 2).length, trails: s.roads.filter(r => r === 1).length }; });
console.log(JSON.stringify(st0)); ok(st0.troops > 100 && st0.armies > 300, `pre-deployed armies (player ${st0.troops} units, ${st0.armies} armies worldwide)`);
await p.screenshot({ path: 'screenshots/v2-main-map.png' });
// zoom on pieces
await G(() => { const g = window.__game, s = g.sim.s; const r = g.world.regions.find(r => s.regions[r.id].o === s.player && r.cap); g.R.focus(r.id, 6); g.select(-1); }); await p.waitForTimeout(400);
await p.screenshot({ path: 'screenshots/v2-unit-pieces.png' });
// auto-generation over time
await G(() => window.__game.setSpeed(4)); await p.waitForTimeout(6000);
const st1 = await G(() => { const s = window.__game.sim.s; return { tick: s.tick, troops: s.armies.filter(a => a.o === s.player).reduce((x, a) => x + Object.values(a.c).reduce((p, q) => p + q, 0), 0) }; });
ok(st1.troops > st0.troops, `armies auto-generate (${st0.troops} → ${st1.troops} by tick ${st1.tick})`);
// roads: movement faster on road than trail, and trails upgrade when owned on both ends
const road = await G(() => { const g = window.__game, sim = g.sim, s = sim.s; const ri = sim.w.edges.findIndex((e, i) => s.roads[i] === 2); const ti = sim.w.edges.findIndex((e, i) => s.roads[i] === 1 && s.regions[e.a].o !== s.regions[e.b].o);
  const e = sim.w.edges[ti]; const before = s.roads[ti]; s.regions[e.b].o = s.regions[e.a].o; sim.roadsGrow(); return { hasRoad: ri >= 0, upgraded: before === 1 && s.roads[ti] === 2 }; });
ok(road.hasRoad && road.upgraded, 'road network exists and auto-extends over newly controlled links');
// air/missile strike blocked by SAM + jamming
await G(() => window.__game.setSpeed(0));
const strike = await G(() => { const g = window.__game, sim = g.sim, s = sim.s, P = s.player;
  const af = s.armies.find(a => a.o === P && sim.dom(a) === 'air'); const foe = sim.w.regions.filter(r => s.regions[r.id].o !== P && sim.dist(af.r, r.id) < 230).sort((a, b) => sim.dist(af.r, a.id) - sim.dist(af.r, b.id))[0];
  const D = s.regions[foe.id].o; s.regions[foe.id].b.samsite = 3; s.regions[foe.id].b.ewstation = 3; sim.addArmy(D, foe.id, { sam: 60, cuas: 80, ew: 40 });
  af.c.uav = 40; af.c.loiter = 30; const before = s.reports.length; const err = sim.apply({ type: 'strike', nation: P, army: af.id, target: foe.id, kinds: ['uav', 'loiter'] });
  for (let i = 0; i < 60 && s.reports.length === before; i++) sim.step(); const rep = s.reports[s.reports.length - 1]; g.R.focus(foe.id, 4); g.select(foe.id); return { err, rep, target: foe.id }; });
console.log(JSON.stringify(strike.rep)); ok(strike.rep && strike.rep.shot + strike.rep.jammed > (strike.rep.shot + strike.rep.jammed + strike.rep.hits) * 0.7, `drone strike mostly blocked: ${strike.rep?.shot} shot down, ${strike.rep?.jammed} jammed, ${strike.rep?.hits} hit`);
// visual air/EW battle: launch a fresh strike and capture mid-flight / impact
await G(t => { const g = window.__game, sim = g.sim, s = sim.s, P = s.player; const af = s.armies.find(a => a.o === P && sim.dom(a) === 'air') || sim.addArmy(P, s.regions.findIndex(r => r.o === P && r.b.airfield), {}); af.c.uav = 30; af.c.loiter = 20; af.c.fighter = 10; af.c.recon = 4; sim.apply({ type: 'strike', nation: P, army: af.id, target: t, kinds: ['uav', 'loiter', 'fighter', 'recon'] }); const D = s.regions[t].o; const da = s.armies.find(a => a.o === D && sim.dom(a) === 'air'); if (da) { da.c.uav = 20; sim.apply({ type: 'strike', nation: D, army: da.id, target: s.regions.findIndex(r => r.o === P && r.b.samsite) , kinds: ['uav'] }); } g.R.cam.z = 3.2; }, strike.target);
await G(() => window.__game.setSpeed(1));
let shot = false; for (let i = 0; i < 40 && !shot; i++) { await p.waitForTimeout(250); const f = await G(() => window.__game.sim.s.fx.length); if (f > 0) { await p.waitForTimeout(100); await G(() => window.__game.tab('nation')); await p.screenshot({ path: 'screenshots/v2-air-ew-battle.png' }); shot = true; } }
if (!shot) await p.screenshot({ path: 'screenshots/v2-air-ew-battle.png' });
// ballistic missile vs SAM L3 (ABM)
const bal = await G(t => { const g = window.__game, sim = g.sim, s = sim.s, P = s.player; const L = sim.addArmy(P, s.regions.findIndex(r => r.o === P && r.b.base), { launcher: 10 }); s.nations[P].missiles.ballistic = 30; const n0 = s.reports.length; sim.apply({ type: 'strike', nation: P, army: L.id, target: t, kinds: ['ballistic'] }); for (let i = 0; i < 40 && s.reports.length === n0; i++) sim.step(); return s.reports[s.reports.length - 1]; }, strike.target);
ok(bal && bal.jammed === 0, `ballistic missiles ignore jamming (shot ${bal?.shot}, hit ${bal?.hits})`);
// AI uses air/missiles/EW and big armies
await G(() => window.__game.setSpeed(4)); await p.waitForTimeout(25000);
const ai = await G(() => { const s = window.__game.sim.s; return { tick: s.tick, aiStrikes: s.reports.filter(r => r.att !== s.player).length, inflight: s.strikes.length, caps: s.regions.filter((r, i) => r.o !== window.__game.world.regions[i].nation).length, aiMoving: s.armies.filter(a => a.o !== s.player && a.path.length).length, aiAntijam: s.nations.filter(n => n.antijam > 0).length, aiEW: s.regions.filter(r => r.b.ewstation).length, armies: s.armies.length }; });
console.log(JSON.stringify(ai)); ok(ai.aiStrikes > 0 && ai.aiMoving > 0, 'AI launches air/missile strikes and moves armies');
const mv = await G(() => { const g = window.__game, sim = g.sim, s = sim.s, P = s.player; const a = s.armies.filter(a => a.o === P && sim.dom(a) === 'land' && !a.path.length).sort((x, y) => Object.values(y.c).reduce((p, q) => p + q, 0) - Object.values(x.c).reduce((p, q) => p + q, 0))[0]; const dest = sim.w.adj[a.r].find(v => s.regions[v.to].o === P && v.to !== a.r)?.to ?? sim.w.adj[a.r][0].to; const from = a.r; const e = g.cmd({ type: 'move', nation: P, army: a.id, dest, frac: 0.5 }); return { e, from, dest }; });
await p.waitForTimeout(6000); const arrived = await G(d => window.__game.sim.s.armies.some(a => a.o === window.__game.sim.s.player && a.r === d), mv.dest); ok(!mv.e && arrived, 'player army split + moved along roads');
await p.click('#menuBtn'); await p.click('#saveBtn'); await p.reload(); await p.waitForSelector('#loadBtn'); await p.click('#loadBtn'); await p.waitForTimeout(800); ok(await G(() => window.__game.sim.s.tick) > 0, 'save/load restores world + state');
// pan perf
const fps = await G(async () => { const g = window.__game; g.R.cam.z = 1.2; let n = 0; const t0 = performance.now(); await new Promise(res => { const f = () => { g.R.cam.x += 3; n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }); return n / 2; });
console.log('pan fps (headless, software render)', fps.toFixed(0), 'armies', ai.armies);
ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs.slice(0, 3)));
await b.close();
