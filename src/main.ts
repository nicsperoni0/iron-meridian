import './style.css';
import { Sim, State, Command, UNITS, MISSILES, BUILDINGS, FOCUS, RES_KEYS, Res, UKey, MKey, BKey, Focus, csum, ANTIJAM_COST, Army } from './sim';
import { BaseData, World, WorldParams, generateWorld, TERRAIN } from './world';
import { Renderer, PLAYER_COLOR } from './render';
import { piece } from './pieces';
const $ = (q: string) => document.querySelector(q) as HTMLElement;
const SAVE = 'ironmeridian.save.v3', TICK_MS = 500;
let base: BaseData, world: World, sim: Sim | null = null, R: Renderer, speed = 1, pending: Command[] = [], acc = 0, last = performance.now(), tab: 'region' | 'armies' | 'nation' = 'region', lastEv = 0;
let strikeKinds = new Set<UKey | MKey>(['uav', 'loiter', 'bomber', 'fighter', 'recon', 'cruise', 'ballistic']);
const RES_LBL: Record<keyof Res, [string, string]> = { money: ['$', '#ffd34d'], manpower: ['MP', '#7fc8ff'], tech: ['TECH', '#c69bff'] };
const fmt = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(0) + 'k' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.floor(n).toString();
const costStr = (c: Partial<Res>) => RES_KEYS.filter(k => c[k]).map(k => `<span style="color:${RES_LBL[k][1]}">${RES_LBL[k][0]}${fmt(c[k]!)}</span>`).join(' ');
const pieceImg = (t: UKey | 'missile', col = PLAYER_COLOR, px = 34) => piece(t, col, px * 2).toDataURL();
const imgCache = new Map<string, string>(); const pimg = (t: UKey | 'missile', col = PLAYER_COLOR) => { const k = t + col; if (!imgCache.has(k)) imgCache.set(k, pieceImg(t, col)); return imgCache.get(k)!; };

async function boot() {
  base = await (await fetch('./world2.json')).json();
  R = new Renderer($('#map') as HTMLCanvasElement); addEventListener('resize', () => R.resize());
  setupInput(); setupStart();
  R.onThreat = (r: number) => { toast(`🚨 INCOMING air/missile threat → ${world.regions[r].n}`, r); beep(); };
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').then(r => r.update()).catch(() => {});
  requestAnimationFrame(loop);
}
// ---------------- new game / world generation screen ----------------
let genP: WorldParams = { seed: Math.floor(Math.random() * 99999) + 1, extra: 3, distortion: 25 };
function regen() { world = generateWorld(base, genP); R.setWorld(world); preview(); nationList(($('#search') as HTMLInputElement).value); }
function setupStart() {
  const seed = $('#seed') as HTMLInputElement, ex = $('#extra') as HTMLInputElement, di = $('#dist') as HTMLInputElement;
  seed.value = String(genP.seed); ex.value = String(genP.extra); di.value = String(genP.distortion); const lab = () => { $('#extraV').textContent = ex.value; $('#distV').textContent = di.value + '%'; };
  let tm = 0; const ch = () => { lab(); genP = { seed: +seed.value || 1, extra: +ex.value, distortion: +di.value }; clearTimeout(tm); tm = window.setTimeout(regen, 120); };
  seed.oninput = ch; ex.oninput = ch; di.oninput = ch; $('#dice').onclick = () => { seed.value = String(Math.floor(Math.random() * 99999) + 1); ch(); };
  ($('#search') as HTMLInputElement).oninput = e => nationList((e.target as HTMLInputElement).value);
  $('#nations').onclick = e => { const b = (e.target as HTMLElement).closest('.nation') as HTMLElement; if (b) newGame(+b.dataset.i!); };
  $('#loadBtn').style.display = localStorage.getItem(SAVE) ? '' : 'none'; $('#loadBtn').onclick = () => load();
  lab(); regen();
}
function nationList(f: string) { const pop = ['USA', 'TUR', 'RUS', 'CHN', 'IND', 'GBR', 'FRA', 'DEU', 'UKR', 'ISR', 'IRN', 'JPN', 'KOR', 'POL', 'BRA', 'SAU', 'PAK', 'EGY', 'AUS', 'CAN'];
  const items = world.nations.map((n, i) => ({ ...n, i, cnt: world.regions.filter(r => r.nation === i).length })).filter(n => n.cnt > 0);
  const v = items.filter(n => f ? n.name.toLowerCase().includes(f.toLowerCase()) : n.fictional || pop.includes(n.code)).sort((a, b) => (+b.fictional - +a.fictional) || (f ? a.name.localeCompare(b.name) : pop.indexOf(a.code) - pop.indexOf(b.code)));
  $('#nations').innerHTML = v.map(n => `<button class="nation" data-i="${n.i}"><b><span class="flag" style="background:${n.color}"></span>${n.name}</b><small>${n.cnt} cities${n.fictional ? ' · NEW NATION' : ''}</small></button>`).join(''); }
function preview() { const cv = $('#preview') as HTMLCanvasElement; const g = cv.getContext('2d')!; const W = cv.width = cv.clientWidth * 2, H = cv.height = cv.clientHeight * 2; const k = Math.min(W / world.w, H / world.h); g.fillStyle = '#081420'; g.fillRect(0, 0, W, H);
  g.setTransform(k, 0, 0, k, (W - world.w * k) / 2, (H - world.h * k) / 2);
  world.geoPolys.forEach((ps, gi) => { const P = new Path2D(); for (const r of ps) { P.moveTo(r[0], r[1]); for (let i = 2; i < r.length; i += 2) P.lineTo(r[i], r[i + 1]); P.closePath(); } g.save(); g.clip(P);
    for (const id of world.geoRegions[gi]) { const r = world.regions[id]; g.fillStyle = world.nations[r.nation].color; const c = r.cell; g.beginPath(); g.moveTo(c[0], c[1]); for (let i = 2; i < c.length; i += 2) g.lineTo(c[i], c[i + 1]); g.closePath(); g.fill(); } g.restore(); });
  g.fillStyle = '#081420'; for (const [x, y, r] of world.lakes) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(216,192,138,0.5)'; g.lineWidth = 1.5; g.beginPath(); for (const e of world.edges) if (e.land) { const A = world.regions[e.a], B = world.regions[e.b]; g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); } g.stroke();
  g.fillStyle = '#fff'; for (const r of world.regions) { g.fillRect(r.x - 2, r.y - 2, 4, 4); } g.setTransform(1, 0, 0, 1, 0, 0);
  $('#genInfo').textContent = `${world.nations.filter((_, i) => world.regions.some(r => r.nation === i)).length} nations · ${world.regions.length} cities · ${world.edges.filter(e => e.land).length} roads · ${world.lakes.length} new seas`; }
function newGame(n: number) { start(Sim.create(world, n)); toast('Tip: tap one of your armies (chess pieces), then MOVE or STRIKE'); }
function start(s: State) { if (JSON.stringify(s.world) !== JSON.stringify(world?.params)) { world = generateWorld(base, s.world); R.setWorld(world); }
  sim = new Sim(world, s); $('#start').style.display = 'none'; $('#hud').style.display = ''; lastEv = s.tick; const cap = world.regions.findIndex(r => s.regions[r.id].o === s.player && r.cap); const c = cap >= 0 ? cap : s.regions.findIndex(r => r.o === s.player); R.focus(c, 2.6); select(c); hud(); }
let actx: AudioContext | null = null; addEventListener('pointerdown', () => { if (!actx) try { actx = new AudioContext(); } catch { } }, { once: true });
function beep() { if (!actx) return; const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; o.type = 'square'; g.gain.setValueAtTime(0.06, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.25); o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.26); }
function save() { if (!sim) return; localStorage.setItem(SAVE, JSON.stringify(sim.s)); toast('Game saved'); }
function load() { const j = localStorage.getItem(SAVE); if (!j) return toast('No save found'); start(JSON.parse(j)); toast('Game loaded'); }
function issue(c: Command): string | null { if (!sim) return 'no game'; const err = precheck(c); if (err) { toast(err); return err; } pending.push(c); setTimeout(() => panel(), 40); return null; }
function precheck(c: Command) { if (!sim) return 'no game'; if (c.type === 'build') return sim.buildCheck(c.nation, c.region, c.b); if (c.type === 'queue') return sim.queueCheck(c.nation, c.region, c.u); return null; }
function setSpeed(v: number) { speed = v; document.querySelectorAll('.spd').forEach(b => b.classList.toggle('on', +(b as HTMLElement).dataset.s! === v)); }
(window as any).__game = { get sim() { return sim; }, get R() { return R; }, get world() { return world; }, base: () => base, generateWorld, cmd: (c: Command) => issue(c), select: (r: number) => select(r), setSpeed: (v: number) => setSpeed(v), setParams: (p: WorldParams) => { genP = p; ($('#seed') as HTMLInputElement).value = String(p.seed); ($('#extra') as HTMLInputElement).value = String(p.extra); ($('#dist') as HTMLInputElement).value = String(p.distortion); $('#extraV').textContent = String(p.extra); $('#distV').textContent = p.distortion + '%'; regen(); }, selectArmy: (id: number) => selectArmy(id), panel: () => panel(), tab: (t: any) => { tab = t; panel(); } };

function loop(t: number) { const dt = Math.min(250, t - last); last = t;
  if (sim && speed > 0 && !sim.s.over) { acc += dt * speed; let n = 0; while (acc >= TICK_MS && n < 6) { sim.step(pending); pending = []; acc -= TICK_MS; n++; } if (n) { hud(); panel(true); } }
  if (sim && speed === 0 && pending.length) { for (const c of pending) { const e = sim.apply(c); if (e) toast(e); } pending = []; hud(); panel(); }
  if (sim) R.draw(sim, speed && !sim.s.over ? acc / TICK_MS : 0, dt); requestAnimationFrame(loop); }
function hud() { if (!sim) return; const s = sim.s, N = s.nations[s.player], inc = sim.income(s.player);
  const troops = s.armies.filter(a => a.o === s.player).reduce((x, a) => x + csum(a.c), 0);
  $('#res').innerHTML = RES_KEYS.map(k => `<div class="r"><i style="color:${RES_LBL[k][1]}">${RES_LBL[k][0]}</i><b>${fmt(N.res[k])}</b><small>+${fmt(inc[k] * 2)}/s</small></div>`).join('') +
    `<div class="r"><i style="color:#9fd17a">FORCES</i><b>${fmt(troops)}</b><small>cap ${sim.unitCap(s.player)}</small></div><div class="r"><i style="color:#ff9d4d">MISSILES</i><b>${N.missiles.cruise}/${N.missiles.ballistic}</b><small>cruise/ballistic</small></div>`;
  const day = Math.floor(s.tick / 120) + 1; $('#clock').textContent = `DAY ${day} · ${String(Math.floor((s.tick % 120) / 5)).padStart(2, '0')}:00`;
  for (const e of s.events) if (e.tick > lastEv) toast(e.text, e.r); if (s.events.length) lastEv = Math.max(lastEv, s.events[s.events.length - 1].tick);
  if (s.over && !$('#over').dataset.shown) { $('#over').dataset.shown = '1'; $('#over').style.display = ''; $('#overT').textContent = s.over === 'victory' ? 'VICTORY' : 'DEFEAT'; } }
function toast(text: string, r?: number) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = text; if (r !== undefined) d.onclick = () => { R.focus(r, Math.max(R.cam.z, 2.5)); select(r); }; $('#toasts').prepend(d); while ($('#toasts').children.length > 4) $('#toasts').lastChild!.remove(); setTimeout(() => d.remove(), 5000); }
function select(r: number) { R.sel = r; if (R.mode === 'none') { const mine = sim && r >= 0 ? sim.s.armies.filter(a => a.r === r && a.o === sim!.s.player && !a.path.length) : []; R.selArmy = mine.length ? mine[0].id : -1; if (R.selArmy >= 0 && tab === 'region') tab = 'armies'; } panel(); }
function selectArmy(id: number) { if (!sim) return; const a = sim.s.armies.find(x => x.id === id); if (!a) return; R.sel = a.r; if (a.o === sim.s.player) { R.selArmy = id; tab = 'armies'; } else tab = 'region'; panel(); }
const compHTML = (c: any, col: string) => (Object.keys(c) as (UKey)[]).sort((a, b) => c[b] - c[a]).map(k => `<span class="uc" title="${UNITS[k].name}"><img src="${pimg(k, col)}">${fmt(c[k])}</span>`).join('');
function panel(soft = false) {
  const el = $('#panel'); if (!sim || R.sel < 0) { el.classList.remove('open'); return; }
  if (soft && (Date.now() - +(el.dataset.t || 0) < 900)) return; el.dataset.t = String(Date.now());
  if (soft && el.matches(':hover') && tab !== 'region') { /* keep stable while interacting */ }
  const s = sim.s, r = R.sel, Rs = s.regions[r], W = world.regions[r], mine = Rs.o === s.player, N = s.nations[s.player];
  const head = `<div class="ph"><div><div class="pn">${W.cap ? '★ ' : ''}${W.n}</div><div class="pc"><span class="flag" style="background:${R.color(sim, Rs.o)}"></span>${world.nations[Rs.o].name}${mine ? ' · YOURS' : ''} · pop ${fmt(W.pop)} · ${TERRAIN[W.terrain]}${W.port ? ' · coast' : ''}</div></div>
    <div class="stats"><span>🛡 ${Math.ceil(Rs.g)}/${sim.maxG(r)}</span><span>×${sim.defMult(r).toFixed(2)}</span></div><button id="close">✕</button></div>`;
  const tabs = `<div class="tabs">${(['region', 'armies', 'nation'] as const).map(t => `<button data-tab="${t}" class="${tab === t ? 'on' : ''}">${t === 'region' ? (mine ? 'BUILD' : 'INTEL') : t === 'armies' ? 'ARMIES' : 'NATION'}</button>`).join('')}</div>`;
  let body = '';
  const vis = sim.seenRegion(s.player, r); const AD = sim.airDefense(Rs.o, r); const intel = !vis ? `<div class="intel"><b>🌫 FOG OF WAR</b><span>No vision. Send recon drones (SCOUT), an AWACS, special forces or units nearby.</span></div>` : `<div class="intel"><b>Air defense here</b><span>🚀 SAM ${AD.sam.toFixed(0)}</span><span>🛸 C-UAS ${AD.cuas.toFixed(0)}</span><span>📡 Jamming ${(AD.jam * 100).toFixed(0)}%</span><span>✈ Fighters ${AD.ftr.toFixed(0)}</span>${AD.abm > 1 ? '<span>ABM ✓</span>' : ''}</div>`;
  if (tab === 'region') {
    const bl = (Object.keys(Rs.b) as BKey[]).map(k => `<span class="chip">${BUILDINGS[k].name}${BUILDINGS[k].max > 1 ? ' L' + Rs.b[k] : ''}</span>`).join('') || '<span class="muted">No military installations</span>';
    body = `<div class="bl">${bl}</div>${Rs.q ? `<div class="q">⚒ ${BUILDINGS[Rs.q.k].name}: ${Rs.q.left}s</div>` : ''}${intel}`;
    if (mine) { const prodB = (Object.keys(Rs.b) as BKey[]).filter(k => ['barracks', 'factory', 'airfield', 'port', 'missile', 'samsite'].includes(k));
      if (prodB.length) { body += `<div class="prod"><div class="ph2">PRODUCTION · units ${sim.unitCount(s.player)}/${sim.unitCap(s.player)}</div>`;
        body += Rs.pq.length ? `<div class="queue">${Rs.pq.map((q, i) => `<button class="qi" data-unq="${i}"><img src="${pimg(q.u in UNITS ? q.u as UKey : 'missile')}"><small>${i === 0 ? q.left + 's' : '…'}</small>✕</button>`).join('')}</div>` : '<div class="muted">Queue empty — tap a unit to queue it.</div>';
        for (const b of prodB) { const us: (UKey | MKey)[] = (Object.keys(UNITS) as UKey[]).filter(u => UNITS[u].at === b); if (b === 'missile') us.push('cruise', 'ballistic');
          body += `<div class="muted">${BUILDINGS[b].name}:</div><div class="kinds">${us.map(u => { const e = sim!.queueCheck(s.player, r, u); const nm = u in UNITS ? UNITS[u as UKey].name : MISSILES[u as MKey].name; const bt = u in UNITS ? UNITS[u as UKey].batch : MISSILES[u as MKey].batch;
            return `<button class="kind pq ${e ? 'dis' : ''}" data-queue="${u}" title="${e || ''}"><img src="${pimg(u in UNITS ? u as UKey : 'missile')}"><span>${nm} ×${bt}<br><small>${costStr(sim!.unitCost(u))} · ${sim!.unitTime(u)}s</small></span></button>`; }).join('')}</div>`; }
        body += '</div>'; } }
    if (mine) body += `<div class="ph2">BUILD — military & city bonus buildings</div><div class="cards">${(Object.keys(BUILDINGS) as BKey[]).map(k => { const d = BUILDINGS[k], l = Rs.b[k] || 0, err = sim!.buildCheck(s.player, r, k); return `<button class="card ${err ? 'dis' : ''}" data-b="${k}"><div class="ct"><b>${l ? d.name + ' → L' + (l + 1) : d.name}</b><small>${err && err !== 'Not enough resources' ? '🔒 ' + err : d.desc}</small><div class="cost">${l < d.max ? costStr(d.cost(l)) + ' · ' + d.time + 's' : 'MAX'}</div></div></button>`; }).join('')}</div>`;
    else { const foes = vis ? s.armies.filter(a => a.r === r && a.o === Rs.o && sim!.seen(s.player, a)) : []; body += foes.length ? `<div class="muted">Enemy forces:</div><div class="comp">${compHTML(foes.reduce((c: any, a) => { for (const k in a.c) c[k] = (c[k] || 0) + (a.c as any)[k]; return c; }, {}), R.color(sim, Rs.o))}</div>` : '<div class="muted">No enemy forces seen.</div>'; }
  } else if (tab === 'armies') {
    const here = s.armies.filter(a => a.r === r && a.o === s.player && !a.path.length); const sel = s.armies.find(a => a.id === R.selArmy && a.o === s.player);
    body = here.length ? here.map(a => `<button class="army ${a.id === R.selArmy ? 'on' : ''}" data-army="${a.id}"><div class="comp">${compHTML(a.c, PLAYER_COLOR)}</div></button>`).join('') : '<div class="muted">None of your idle armies here. Tap one of your pieces on the map.</div>';
    if (sel) { const air = sim.dom(sel) === 'air'; const canStrike = air || (sel.c.launcher || 0) > 0;
      const kinds: (UKey | MKey)[] = ['fighter', 'bomber', 'uav', 'recon', 'loiter', 'cruise', 'ballistic']; const avail = kinds.filter(k => k === 'cruise' || k === 'ballistic' ? (sel.c.launcher || 0) > 0 && N.missiles[k as MKey] > 0 : (sel.c as any)[k] > 0);
      body += `<div class="acts">${!air ? `<button id="mvAll" class="big">MOVE ALL ▸</button><button id="mvHalf" class="big alt">SPLIT ½ ▸</button>` : `<button id="mvAll" class="big alt">REBASE ▸</button>`}${canStrike ? `<button id="strike" class="big red">STRIKE ▸</button>` : ''}${(sel.c.recon || sel.c.uav) ? `<button id="scout" class="big alt">🛰 SCOUT ▸</button>` : ''}</div>`;
      if (canStrike) body += `<div class="muted">Strike package (tap to toggle):</div><div class="kinds">${avail.map(k => `<button class="kind ${strikeKinds.has(k) ? 'on' : ''}" data-kind="${k}"><img src="${pimg(k === 'cruise' || k === 'ballistic' ? 'missile' : k as UKey)}">${k === 'cruise' || k === 'ballistic' ? MISSILES[k as MKey].name + ' ' + N.missiles[k as MKey] : UNITS[k as UKey].name}</button>`).join('')}</div>`; }
  } else {
    body = `<div class="muted">Units: <b>${sim.unitCount(s.player)} / ${sim.unitCap(s.player)}</b> cap (grows with the population you control). Queue units at your Barracks, Factories, Airfields, Ports, Missile & Air Defense Sites (BUILD tab).</div>
      <button id="antijam" class="card ${N.antijam >= 3 || !sim.canAfford(s.player, ANTIJAM_COST(N.antijam)) ? 'dis' : ''}"><div class="ct"><b>GPS Anti-Jam / EW Protection L${N.antijam} → L${Math.min(3, N.antijam + 1)}</b><small>Each level cuts enemy jamming of your drones, missiles & artillery by 28%</small><div class="cost">${N.antijam < 3 ? costStr(ANTIJAM_COST(N.antijam)) : 'MAX'}</div></div></button>

      <div class="rps"><b>Who beats what</b>
      <div>🛸 <b>Drones & loitering munitions</b> ← beaten by <b>C-UAS</b> and <b>EW jamming</b></div>
      <div>🚀 <b>Cruise missiles</b> ← <b>SAM</b> + <b>fighters</b>, and GPS <b>jamming</b> makes them miss</div>
      <div>☄ <b>Ballistic missiles</b> ← only <b>SAM L2+ (ABM interceptors)</b>, can't be jammed</div>
      <div>✈ <b>Jets & bombers</b> ← <b>SAM</b> sites/batteries and enemy <b>fighters</b> (escort with your own)</div>
      <div>📡 <b>EW jamming</b> ← your <b>GPS anti-jam</b> upgrades; destroy EW stations with ballistic/bomber strikes</div>
      <div>🎯 <b>Recon drones</b> in a package add +40% accuracy</div></div>`;
    const rep = s.reports.slice(-3).reverse(); if (rep.length) body += `<div class="muted">Recent strikes:</div>` + rep.map(x => `<div class="rep ${x.att === s.player ? 'me' : ''}">${x.att === s.player ? '🎯' : x.def === s.player ? '🚨' : '•'} ${world.nations[x.att].name} → ${world.regions[x.target].n}: sent ${x.sent}. <b>${x.shot}</b> shot down, <b>${x.jammed}</b> jammed, <b>${x.hits}</b> hit.</div>`).join('');
  }
  el.innerHTML = head + tabs + body; el.classList.add('open');
  el.querySelector('#close')!.addEventListener('click', () => { R.sel = -1; R.selArmy = -1; panel(); });
  el.querySelectorAll('[data-tab]').forEach(x => (x as HTMLElement).onclick = () => { tab = (x as HTMLElement).dataset.tab as any; panel(); });
  el.querySelectorAll('[data-b]').forEach(x => (x as HTMLElement).onclick = () => issue({ type: 'build', nation: s.player, region: r, b: (x as HTMLElement).dataset.b as BKey }));
  el.querySelectorAll('[data-army]').forEach(x => (x as HTMLElement).onclick = () => { R.selArmy = +(x as HTMLElement).dataset.army!; panel(); });
  el.querySelectorAll('[data-kind]').forEach(x => (x as HTMLElement).onclick = () => { const k = (x as HTMLElement).dataset.kind as any; strikeKinds.has(k) ? strikeKinds.delete(k) : strikeKinds.add(k); panel(); });
  el.querySelectorAll('[data-focus]').forEach(x => (x as HTMLElement).onclick = () => issue({ type: 'focus', nation: s.player, focus: (x as HTMLElement).dataset.focus as Focus }));
  el.querySelectorAll('[data-queue]').forEach(x => (x as HTMLElement).onclick = () => issue({ type: 'queue', nation: s.player, region: r, u: (x as HTMLElement).dataset.queue as any }));
  el.querySelectorAll('[data-unq]').forEach(x => (x as HTMLElement).onclick = () => issue({ type: 'unqueue', nation: s.player, region: r, i: +(x as HTMLElement).dataset.unq! }));
  const aj = el.querySelector('#antijam') as HTMLElement; if (aj) aj.onclick = () => issue({ type: 'antijam', nation: s.player });
  const ma = el.querySelector('#mvAll') as HTMLElement; if (ma) ma.onclick = () => beginMode('move', 1);
  const mh = el.querySelector('#mvHalf') as HTMLElement; if (mh) mh.onclick = () => beginMode('move', 0.5);
  const st = el.querySelector('#strike') as HTMLElement; if (st) st.onclick = () => beginMode('strike', 1);
  const so = el.querySelector('#scout') as HTMLElement; if (so) so.onclick = () => beginMode('scout', 1);
}
let moveFrac = 1;
function beginMode(m: 'move' | 'strike' | 'scout', frac: number) { R.mode = m; moveFrac = frac; $('#moveHint').style.display = ''; $('#hintT').textContent = m === 'strike' ? 'Tap enemy target to STRIKE' : m === 'scout' ? 'Tap area to SCOUT with drones' : 'Tap destination'; $('#panel').classList.remove('open'); }
function endMode(target: number) { const m = R.mode; R.mode = 'none'; $('#moveHint').style.display = 'none'; if (!sim || target < 0 || R.selArmy < 0) return; const a = sim.s.armies.find(x => x.id === R.selArmy); if (!a) return;
  if (m === 'move') { pending.push({ type: 'move', nation: sim.s.player, army: a.id, dest: target, frac: moveFrac }); toast(`Army moving to ${world.regions[target].n}`); }
  else if (m === 'scout') { pending.push({ type: 'scout', nation: sim.s.player, army: a.id, target }); toast(`Recon drones heading to ${world.regions[target].n}`); }
  else { const AD = sim.airDefense(sim.s.regions[target].o, target); pending.push({ type: 'strike', nation: sim.s.player, army: a.id, target, kinds: [...strikeKinds] }); toast(sim.seenRegion(sim.s.player, target) ? `Strike launched at ${world.regions[target].n} (SAM ${AD.sam.toFixed(0)}, C-UAS ${AD.cuas.toFixed(0)}, jamming ${(AD.jam * 100).toFixed(0)}%)` : `Strike launched blind at ${world.regions[target].n} — defenses unknown`); } }
function setupInput() {
  const cv = $('#map'); const pts = new Map<number, { x: number; y: number }>(); let down = { x: 0, y: 0 }, moved = false, pinch0 = 0, z0 = 1;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) { down = { x: e.clientX, y: e.clientY }; moved = false; } if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); z0 = R.cam.z; moved = true; } });
  cv.addEventListener('pointermove', e => { const prev = pts.get(e.pointerId); if (!prev) return; const cur = { x: e.clientX, y: e.clientY };
    if (pts.size === 1) { if (Math.hypot(cur.x - down.x, cur.y - down.y) > 8) moved = true; if (moved) { R.cam.x -= (cur.x - prev.x) / R.cam.z; R.cam.y -= (cur.y - prev.y) / R.cam.z; } }
    else if (pts.size === 2) { pts.set(e.pointerId, cur); const [a, b] = [...pts.values()]; zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, z0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch0); return; } pts.set(e.pointerId, cur); });
  cv.addEventListener('pointerup', e => { pts.delete(e.pointerId); if (pts.size || moved || !sim) return; tap(e.clientX, e.clientY); });
  cv.addEventListener('pointercancel', e => pts.delete(e.pointerId));
  cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, R.cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
  document.querySelectorAll('.spd').forEach(b => (b as HTMLElement).onclick = () => setSpeed(+(b as HTMLElement).dataset.s!));
  $('#menuBtn').onclick = () => $('#menu').classList.toggle('open'); $('#saveBtn').onclick = () => { save(); $('#menu').classList.remove('open'); }; $('#loadBtn2').onclick = () => { load(); $('#menu').classList.remove('open'); };
  $('#newBtn').onclick = () => { $('#menu').classList.remove('open'); sim = null; $('#hud').style.display = 'none'; $('#start').style.display = ''; setupStart(); };
  $('#homeBtn').onclick = () => { if (!sim) return; const c = world.regions.findIndex(r => sim!.s.regions[r.id].o === sim!.s.player && r.cap); const k = c >= 0 ? c : sim.s.regions.findIndex(r => r.o === sim!.s.player); R.focus(k, 2.6); select(k); };
  $('#cancelMove').onclick = () => endMode(-1);
  setInterval(() => { if (sim && !sim.s.over) localStorage.setItem(SAVE, JSON.stringify(sim.s)); }, 30000);
}
function tap(x: number, y: number) { if (R.mode !== 'none') { const r = R.pickRegion(x, y); endMode(r); if (r >= 0) select(r); return; } const id = R.pickArmy(x, y); if (id >= 0) return selectArmy(id); select(R.pickRegion(x, y)); }
function zoomAt(sx: number, sy: number, z: number) { z = Math.max(0.3, Math.min(14, z)); const [wx, wy] = R.toWorld(sx, sy); R.cam.z = z; R.cam.x = wx - sx / z; R.cam.y = wy - sy / z; }
void (null as unknown as Army);
boot();
