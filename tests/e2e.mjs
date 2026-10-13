import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:8787/';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e)));
await p.goto(URL); await p.waitForSelector('.nation');
await p.screenshot({ path: 'screenshots/00-start.png' });
await p.fill('#search', 'Turkey'); await p.click('.nation');
await p.waitForTimeout(1500);
const G = (fn, a) => p.evaluate(fn, a);
const info = await G(() => { const g = window.__game, s = g.sim.s; const cap = s.provs.findIndex(x => x.o === s.player && x.b.city); const nb = g.sim.map.provinces[cap].nb.filter(j => s.provs[j].o === s.player); const foe = []; s.provs.forEach((P,i)=>{ if(P.o===s.player) g.sim.map.provinces[i].nb.forEach(j=>{ if(s.provs[j].o!==s.player) foe.push(j)})}); return { cap, nb, foe, player: s.player }; });
console.log('info', JSON.stringify(info));
await p.tap('#map', { position: { x: 195, y: 330 } }).catch(()=>{});
await G(c => window.__game.select(c), info.cap); await p.waitForTimeout(300);
await p.screenshot({ path: 'screenshots/01-main-map.png' });
// found a city next to the capital's army base via the UI
const site = info.nb[0];
await G(c => window.__game.select(c), site); await p.waitForTimeout(300);
await p.click('[data-tab=build]').catch(()=>{}); await p.waitForTimeout(200);
await p.screenshot({ path: 'screenshots/02-city-build-menu.png' });
await p.click('[data-b=city]'); await p.waitForTimeout(200);
await G(() => window.__game.setSpeed(4)); await p.waitForTimeout(3500);
const city = await G(c => window.__game.sim.s.provs[c].b.city, site); console.log('new city level', city);
// defenses at capital
for (const k of ['bunker','sam','artillery']) { await G(([c,k]) => window.__game.cmd({ type:'build', nation: window.__game.sim.s.player, prov:c, b:k }), [info.cap,k]); await p.waitForTimeout(2800); }
const out = info.nb.find(j => j !== site); await G(([c]) => window.__game.cmd({ type:'build', nation: window.__game.sim.s.player, prov:c, b:'outpost' }), [out]);
// train units via UI
await G(c => window.__game.select(c), info.cap); await p.waitForTimeout(200); await p.click('[data-tab=train]');
for (const u of ['infantry','mech','infantry','artillery']) { await p.click(`[data-u=${u}]`); await p.waitForTimeout(150); }
await p.screenshot({ path: 'screenshots/03-train-menu.png' });
await p.waitForTimeout(9000);
const st = await G(c => { const s = window.__game.sim.s; return { b: s.provs[c].b, units: s.units.filter(u=>u.o===s.player).length, tick: s.tick }; }, info.cap); console.log('capital', JSON.stringify(st));
// attack weakest neighboring foreign province
const target = await G(foe => { const s = window.__game.sim.s; return foe.sort((a,b)=>s.provs[a].g-s.provs[b].g)[0]; }, info.foe);
await G(([c, t]) => { const g = window.__game, s = g.sim.s; const ids = s.units.filter(u => u.o === s.player && s.provs[u.p].o===s.player && window.__game.sim.map.provinces[0] && true).map(u => u.id); g.cmd({ type:'move', nation:s.player, units: ids, dest:t }); g.select(t); g.R.focus(t, 7); }, [info.cap, target]);
let shot = false;
for (let i = 0; i < 40; i++) { await p.waitForTimeout(700); const f = await G(t => { const s = window.__game.sim.s; return { here: s.units.filter(u=>u.p===t && u.o===s.player).length, g: s.provs[t].g, o: s.provs[t].o }; }, target);
  if (f.here && !shot && f.g < 15) { await p.screenshot({ path: 'screenshots/04-combat.png' }); shot = true; }
  if (f.o === info.player) { console.log('captured target at step', i); break; } }
await p.screenshot({ path: 'screenshots/05-after-attack.png' });
// let AI run
await p.waitForTimeout(15000);
const ai = await G(() => { const s = window.__game.sim.s; const aiU = s.units.filter(u=>u.o!==s.player); return { tick: s.tick, aiUnits: aiU.length, aiMoving: aiU.filter(u=>u.path.length).length, aiCities: s.provs.filter(p=>p.o!==s.player && p.b.city).length, aiQueued: s.provs.filter(p=>p.o!==s.player && (p.q||p.tq.length)).length, captures: s.provs.filter((p,i)=>p.o!==window.__game.sim.map.provinces[i].c).length, events: s.events.slice(-6).map(e=>e.text) }; });
console.log('ai', JSON.stringify(ai));
// zoomed-out world view & save/load
await G(() => { const g = window.__game; g.R.cam.z = 0.9; g.R.cam.x = 1050; g.R.cam.y = 120; g.select(-1); }); await p.waitForTimeout(400);
await p.screenshot({ path: 'screenshots/06-world.png' });
await p.click('#menuBtn'); await p.click('#saveBtn'); const saved = await G(() => localStorage.getItem('ironmeridian.save.v1')?.length); console.log('save bytes', saved);
await p.reload(); await p.waitForSelector('#loadBtn'); await p.click('#loadBtn'); await p.waitForTimeout(800); console.log('loaded tick', await G(() => window.__game.sim.s.tick));
await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(500); await p.screenshot({ path: 'screenshots/07-landscape.png' });
console.log('ERRORS', errs.length, errs.slice(0, 5));
await b.close();
