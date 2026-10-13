import './style.css';
import { Sim, State, MapData, Command, BUILDINGS, UNITS, BKey, UKey, RES_KEYS, CITY_NAMES, Res } from './sim';
import { Renderer } from './render';
import { icon } from './icons';
const $ = (q: string) => document.querySelector(q) as HTMLElement;
const SAVE = 'ironmeridian.save.v1';
const TICK_MS = 500;
let map: MapData, sim: Sim | null = null, R: Renderer, speed = 1, pending: Command[] = [], acc = 0, last = performance.now(), tab: 'build' | 'train' | 'units' = 'build', lastEv = 0, moveMode = false;
const RES_LBL: Record<keyof Res, [string, string]> = { money: ['$', '#ffd34d'], supplies: ['SUP', '#9fd17a'], fuel: ['FUEL', '#ff9d4d'], manpower: ['MP', '#7fc8ff'], electronics: ['ELEC', '#c69bff'] };
const fmt = (n: number) => n >= 10000 ? (n / 1000).toFixed(0) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : Math.floor(n).toString();
const costStr = (c: Partial<Res>) => RES_KEYS.filter(k => c[k]).map(k => `<span style="color:${RES_LBL[k][1]}">${RES_LBL[k][0]}${c[k]}</span>`).join(' ');

async function boot() {
  map = await (await fetch('./world.json')).json();
  R = new Renderer($('#map') as HTMLCanvasElement, map);
  addEventListener('resize', () => R.resize());
  setupInput(); setupStart();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  R.cam.z = innerWidth / map.w * 1.6; R.cam.x = 200; R.cam.y = 80;
  requestAnimationFrame(loop);
}
function setupStart() {
  const list = $('#nations'); const pop = ['USA', 'TUR', 'RUS', 'CHN', 'IND', 'GBR', 'FRA', 'DEU', 'BRA', 'JPN', 'UKR', 'POL', 'ISR', 'IRN', 'SAU', 'EGY', 'AUS', 'CAN', 'MEX', 'KOR'];
  const items = map.countries.map((c, i) => ({ ...c, i, n: map.provinces.filter(p => p.c === i).length })).filter(c => c.n >= 3);
  const render = (f: string) => { const v = items.filter(c => !f ? pop.includes(c.code) : c.name.toLowerCase().includes(f.toLowerCase())).sort((a, b) => f ? a.name.localeCompare(b.name) : pop.indexOf(a.code) - pop.indexOf(b.code));
    list.innerHTML = v.map(c => `<button class="nation" data-i="${c.i}"><b>${c.name}</b><small>${c.n} provinces</small></button>`).join(''); };
  render(''); ($('#search') as HTMLInputElement).oninput = e => render((e.target as HTMLInputElement).value);
  list.onclick = e => { const b = (e.target as HTMLElement).closest('.nation') as HTMLElement; if (b) newGame(+b.dataset.i!); };
  $('#loadBtn').style.display = localStorage.getItem(SAVE) ? '' : 'none';
  $('#loadBtn').onclick = () => load();
}
function newGame(n: number) { start(Sim.create(map, n, (Date.now() & 0xffff) + 1)); toast('Tip: tap your capital, then BUILD → City near your Army Base'); }
function start(s: State) { sim = new Sim(map, s); $('#start').style.display = 'none'; $('#hud').style.display = ''; lastEv = s.events.length ? s.events[s.events.length - 1].tick : 0;
  const cap = s.provs.findIndex(p => p.o === s.player && p.b.city); R.focus(cap, 5); select(cap); }
function save() { if (!sim) return; localStorage.setItem(SAVE, JSON.stringify(sim.s)); toast('Game saved'); }
function load() { const j = localStorage.getItem(SAVE); if (!j) return toast('No save found'); start(JSON.parse(j)); toast('Game loaded'); }
(window as any).__game = { get sim() { return sim; }, get R() { return R; }, cmd: (c: Command) => issue(c), select: (p: number) => select(p), setSpeed: (v: number) => setSpeed(v) };

function issue(c: Command) { if (!sim) return 'no game'; const err = c.type === 'build' ? sim.buildCheck(c.nation, c.prov, c.b) : c.type === 'train' ? sim.trainCheck(c.nation, c.prov, c.u) : null; if (err) { toast(err); return err; } pending.push(c); setTimeout(() => panel(), 30); return null; }
function setSpeed(v: number) { speed = v; document.querySelectorAll('.spd').forEach(b => b.classList.toggle('on', +(b as HTMLElement).dataset.s! === v)); }
function loop(t: number) {
  const dt = Math.min(250, t - last); last = t;
  if (sim && speed > 0 && !sim.s.over) { acc += dt * speed; let n = 0; while (acc >= TICK_MS && n < 8) { sim.step(pending); pending = []; acc -= TICK_MS; n++; } if (n) { hud(); if (sim.s.tick % 2 === 0) panel(true); } }
  if (sim && speed === 0 && pending.length) { for (const c of pending) sim.apply(c); pending = []; hud(); panel(); }
  if (sim) R.draw(sim, speed ? acc / TICK_MS : 0);
  requestAnimationFrame(loop);
}
function hud() {
  if (!sim) return; const s = sim.s; const N = s.nations[s.player]; const inc = sim.income(s.player);
  $('#res').innerHTML = RES_KEYS.map(k => `<div class="r"><i style="color:${RES_LBL[k][1]}">${RES_LBL[k][0]}</i><b>${fmt(N.res[k])}</b><small>+${fmt(inc[k] * 2)}/s</small></div>`).join('');
  const day = Math.floor(s.tick / 120) + 1; $('#clock').textContent = `DAY ${day} · ${String(Math.floor((s.tick % 120) / 5)).padStart(2, '0')}:00`;
  for (const e of s.events) if (e.tick > lastEv) { toast(e.text, e.prov); } if (s.events.length) lastEv = Math.max(lastEv, s.events[s.events.length - 1].tick);
  if (s.over && !$('#over').dataset.shown) { $('#over').dataset.shown = '1'; $('#over').style.display = ''; }
}
let toastT = 0;
function toast(text: string, prov?: number) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = text; if (prov !== undefined) d.onclick = () => { R.focus(prov, Math.max(R.cam.z, 4)); select(prov); }; $('#toasts').prepend(d); while ($('#toasts').children.length > 4) $('#toasts').lastChild!.remove(); setTimeout(() => d.remove(), 5000); toastT++; }

function select(p: number) { R.sel = p; if (!moveMode) R.selUnits = []; panel(); }
function panel(soft = false) {
  const el = $('#panel'); if (!sim || R.sel < 0) { el.classList.remove('open'); return; }
  if (soft && document.activeElement && el.contains(document.activeElement) && tab === 'units') { /* keep */ }
  const s = sim.s, p = R.sel, P = s.provs[p], M = map.provinces[p], mine = P.o === s.player; const b = P.b;
  const myUnits = s.units.filter(u => u.p === p && u.o === s.player); const foe = s.units.filter(u => u.p === p && u.o !== s.player);
  const head = `<div class="ph"><div><div class="pn">${M.n}</div><div class="pc"><span class="flag" style="background:${mine ? '#2f6b4f' : R.colors[P.o]}"></span>${map.countries[P.o].name}${mine ? ' · YOURS' : ''}</div></div>
    <div class="stats"><span title="Garrison">🛡 ${Math.ceil(P.g)}/${sim.maxGarrison(p)}</span><span title="Protection">×${sim.protection(p).toFixed(2)}</span>${b.city ? `<span class="lvl">${CITY_NAMES[b.city]}</span>` : ''}</div><button id="close">✕</button></div>`;
  const blist = (Object.keys(b) as BKey[]).map(k => `<span class="chip">${k === 'city' ? CITY_NAMES[b.city!] : BUILDINGS[k].name}${BUILDINGS[k].max > 1 && k !== 'city' ? ' L' + b[k] : ''}</span>`).join('') || '<span class="muted">No buildings</span>';
  const q = (P.q ? `<div class="q">⚒ Building ${P.q.k === 'city' ? CITY_NAMES[(b.city || 0) + 1] : BUILDINGS[P.q.k].name}: ${P.q.left}s</div>` : '') + (P.tq.length ? `<div class="q">🎖 Training: ${P.tq.map(t => UNITS[t.u].short).join(', ')} (${P.tq[0].left}s)</div>` : '');
  let body = '';
  if (mine) {
    const tabs = `<div class="tabs">${(['build', 'train', 'units'] as const).map(t => `<button data-tab="${t}" class="${tab === t ? 'on' : ''}">${t === 'units' ? `UNITS (${myUnits.length})` : t.toUpperCase()}</button>`).join('')}</div>`;
    if (tab === 'build') body = (Object.keys(BUILDINGS) as BKey[]).map(k => { const d = BUILDINGS[k]; const lvl = b[k] || 0; const err = sim!.buildCheck(s.player, p, k);
      const nm = k === 'city' ? (lvl ? `Upgrade to ${CITY_NAMES[lvl + 1] || 'MAX'}` : 'Found Village') : lvl ? `${d.name} → L${lvl + 1}` : d.name;
      return `<button class="card ${err ? 'dis' : ''}" data-b="${k}"><div class="ci"><canvas data-icon="${k}" data-l="${Math.max(1, Math.min(d.max, lvl + 1))}" width="36" height="36"></canvas></div><div class="ct"><b>${nm}</b><small>${err && err !== 'Not enough resources' ? '🔒 ' + err : d.desc}</small><div class="cost">${lvl < d.max ? costStr(d.cost(lvl)) + ` · ${d.time}s` : 'MAX'}</div></div></button>`; }).join('');
    if (tab === 'train') body = (Object.keys(UNITS) as UKey[]).map(k => { const d = UNITS[k]; const err = sim!.trainCheck(s.player, p, k);
      return `<button class="card ${err ? 'dis' : ''}" data-u="${k}"><div class="ci unit">${d.short}</div><div class="ct"><b>${d.name}</b><small>${err && err !== 'Not enough resources' ? '🔒 ' + err : `ATK ${d.atk} · DEF ${d.def} · HP ${d.hp} · ${d.dom}`}</small><div class="cost">${costStr(d.cost)} · ${d.time}s</div></div></button>`; }).join('');
    if (tab === 'units') body = myUnits.length ? `<div class="ulist">${myUnits.map(u => `<label class="urow"><input type="checkbox" data-id="${u.id}" ${R.selUnits.includes(u.id) ? 'checked' : ''}> <b>${UNITS[u.t].name}</b> <span class="hp"><i style="width:${(u.hp / UNITS[u.t].hp) * 100}%"></i></span>${u.path.length ? ' → moving' : ''}</label>`).join('')}</div><button id="moveBtn" class="big">MOVE / ATTACK ▸ tap destination</button><button id="selAll" class="small">Select all</button>` : '<div class="muted">No units here. Train some in TRAIN.</div>';
    body = tabs + `<div class="cards">${body}</div>`;
  } else {
    body = `<div class="muted">Enemy forces here: ${foe.length ? foe.map(u => UNITS[u.t].short).join(' ') : 'none seen'}</div>` + (myUnits.length ? `<button id="selAll" class="big">Select my ${myUnits.length} unit(s) here</button>` : '') + `<div class="muted">Tip: select your units in a nearby province, tap MOVE, then tap here to attack.</div>`;
  }
  if (soft && el.dataset.sig === `${p}|${tab}|${mine}` && tab !== 'units') { // update only dynamic texts to avoid flicker
    el.querySelector('.ph')!.outerHTML = head; const qq = el.querySelector('.qwrap'); if (qq) qq.innerHTML = q; refreshCards(); bindClose(); return; }
  if (soft && tab === 'units' && el.dataset.sig === `${p}|${tab}|${mine}|${myUnits.length}`) { el.querySelector('.ph')!.outerHTML = head; bindClose(); return; }
  el.dataset.sig = `${p}|${tab}|${mine}` + (tab === 'units' ? `|${myUnits.length}` : '');
  el.innerHTML = head + `<div class="bl">${blist}</div><div class="qwrap">${q}</div>` + body; el.classList.add('open');
  el.querySelectorAll('canvas[data-icon]').forEach(c => { const cv = c as HTMLCanvasElement; cv.getContext('2d')!.drawImage(icon(cv.dataset.icon!, +cv.dataset.l!, true, 72), 0, 0, 36, 36); });
  bindClose();
  el.querySelectorAll('[data-tab]').forEach(x => (x as HTMLElement).onclick = () => { tab = (x as HTMLElement).dataset.tab as any; panel(); });
  el.querySelectorAll('[data-b]').forEach(x => (x as HTMLElement).onclick = () => issue({ type: 'build', nation: s.player, prov: p, b: (x as HTMLElement).dataset.b as BKey }));
  el.querySelectorAll('[data-u]').forEach(x => (x as HTMLElement).onclick = () => issue({ type: 'train', nation: s.player, prov: p, u: (x as HTMLElement).dataset.u as UKey }));
  el.querySelectorAll('input[data-id]').forEach(x => (x as HTMLInputElement).onchange = () => { const id = +(x as HTMLElement).dataset.id!; R.selUnits = (x as HTMLInputElement).checked ? [...R.selUnits, id] : R.selUnits.filter(i => i !== id); });
  const sa = el.querySelector('#selAll') as HTMLElement; if (sa) sa.onclick = () => { R.selUnits = myUnits.map(u => u.id); if (!mine) startMove(); else panel(); };
  const mb = el.querySelector('#moveBtn') as HTMLElement; if (mb) mb.onclick = () => { if (!R.selUnits.length) R.selUnits = myUnits.map(u => u.id); startMove(); };
}
function refreshCards() { if (!sim) return; const s = sim.s, p = R.sel; $('#panel').querySelectorAll('[data-b]').forEach(x => x.classList.toggle('dis', !!sim!.buildCheck(s.player, p, (x as HTMLElement).dataset.b as BKey))); $('#panel').querySelectorAll('[data-u]').forEach(x => x.classList.toggle('dis', !!sim!.trainCheck(s.player, p, (x as HTMLElement).dataset.u as UKey))); }
function bindClose() { const c = $('#panel').querySelector('#close') as HTMLElement; if (c) c.onclick = () => { R.sel = -1; R.selUnits = []; panel(); }; }
function startMove() { moveMode = true; $('#moveHint').style.display = ''; $('#panel').classList.remove('open'); }
function endMove(dest: number) { moveMode = false; $('#moveHint').style.display = 'none'; if (dest >= 0 && sim && R.selUnits.length) { pending.push({ type: 'move', nation: sim.s.player, units: [...R.selUnits], dest }); toast(`${R.selUnits.length} unit(s) moving to ${map.provinces[dest].n}`); } }

function setupInput() {
  const cv = $('#map'); const pts = new Map<number, { x: number; y: number }>(); let down = { x: 0, y: 0, t: 0 }, moved = false, pinch0 = 0, z0 = 1;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) { down = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = false; } if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); z0 = R.cam.z; moved = true; } });
  cv.addEventListener('pointermove', e => { const prev = pts.get(e.pointerId); if (!prev) return; const cur = { x: e.clientX, y: e.clientY };
    if (pts.size === 1) { if (Math.hypot(cur.x - down.x, cur.y - down.y) > 8) moved = true; if (moved) { R.cam.x -= (cur.x - prev.x) / R.cam.z; R.cam.y -= (cur.y - prev.y) / R.cam.z; } }
    else if (pts.size === 2) { pts.set(e.pointerId, cur); const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; zoomAt(mx, my, z0 * d / pinch0); return; }
    pts.set(e.pointerId, cur); });
  const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size === 0 && !moved) { const p = R.pick(e.clientX, e.clientY); if (moveMode) { endMove(p); if (p >= 0) select(p); } else select(p); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => pts.delete(e.pointerId));
  cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, R.cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
  document.querySelectorAll('.spd').forEach(b => (b as HTMLElement).onclick = () => setSpeed(+(b as HTMLElement).dataset.s!));
  $('#menuBtn').onclick = () => $('#menu').classList.toggle('open');
  $('#saveBtn').onclick = () => { save(); $('#menu').classList.remove('open'); };
  $('#loadBtn2').onclick = () => { load(); $('#menu').classList.remove('open'); };
  $('#newBtn').onclick = () => { $('#menu').classList.remove('open'); sim = null; $('#hud').style.display = 'none'; $('#start').style.display = ''; setupStart(); };
  $('#homeBtn').onclick = () => { if (!sim) return; const cap = sim.s.provs.findIndex(p => p.o === sim!.s.player && p.b.city); if (cap >= 0) { R.focus(cap, 5); select(cap); } };
  $('#cancelMove').onclick = () => endMove(-1);
  setInterval(() => { if (sim && !sim.s.over) localStorage.setItem(SAVE, JSON.stringify(sim.s)); }, 30000); // autosave
}
function zoomAt(sx: number, sy: number, z: number) { z = Math.max(0.15, Math.min(40, z)); const [wx, wy] = R.toWorld(sx, sy); R.cam.z = z; R.cam.x = wx - sx / z; R.cam.y = wy - sy / z; }
boot();
