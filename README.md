# Iron Meridian v3 — air, missiles, EW & fog of war (mobile strategy prototype)

Original game (no third-party art/names/assets). TypeScript + Vite + Canvas 2D, installable PWA.
Live: https://nicsperoni0.github.io/iron-meridian/

    npm install && npm run build        # dist/ (postbuild stamps a new service-worker cache id)
    python3 -m http.server 8787 -d dist
    node tests/v3.mjs                   # Playwright @390x844 (+ webm recording): worldgen, buildings/production, fog, recon/AWACS, strikes vs SAM/EW, AI
    npm run map                         # rebuild public/world2.json from Natural Earth (data/)

## What's new in v3
- **Visuals**: large outlined pseudo-3D chess pieces rendered at devicePixelRatio (sprite cache), screen-space min size,
  screen-space clustering of overlapping stacks (expands when zoomed in), glowing/bobbing selected piece.
  Animated flights on curved paths with heading rotation, contrails/missile smoke, propeller blur, mid-air interception
  explosions, jammed drones spiraling away. Air patrols circle airfields. Rotating radar sweeps + ping rings (SAM, airfields,
  EW, AWACS), radar blips + SAM LOCK lines on incoming aircraft/missiles, purple jamming static, INCOMING edge markers + beep.
- **Production only from buildings** (no free spawning): Barracks (infantry, special forces), Factory (IFV, tank, artillery,
  jammer, mobile anti-drone AA), Airfield (jets, bombers, drones, AWACS), Port (frigates), Missile Site (launchers, cruise &
  ballistic missiles), Air Defense Site (SAM batteries). Player-controlled queues, unit cap from controlled population.
  Nations open with 15–50 pre-placed ground units + a few starting buildings.
- **City bonus buildings** (3 levels each): Sports Stadium (production speed), Skyscraper (money), Bridge (production + faster
  roads from the city), Tech Campus (tech), Power Plant (all income + production), Hospital (manpower + garrison recovery).
- **Fog of war** (in the deterministic sim, so the AI obeys it too): vision from own territory/units (short), SAM/airfield/EW
  radars, special forces (stealthy: only revealed by close presence/drones), recon/attack drones hovering via SCOUT, and the
  AWACS radar plane (big radius). Hidden regions are dimmed and show faded last-known pieces.
- AI builds production + bonus buildings, queues units by doctrine, scouts with drones, strikes only what it can see.

## v2 base
- **World generation per game** (`src/world.ts`): real Natural Earth countries + 645 real major cities (picked by population,
  ~1 + sqrt(pop in millions) per country). Seed + 0–10 fictional nations carved out of existing ones + 0–100% distortion
  (country shift/scale, coastline noise, new inland seas). 0% = real world. Fully deterministic from `WorldParams`.
- **Chessboard regions**: one region per city (Voronoi cell clipped to its country), ~645 instead of 2,645 provinces.
- **Roads**: Delaunay graph between cities. Land links = roads (fast) or trails (slow, dashed); short water links = sea lanes.
  Trails auto-upgrade to roads once one nation controls both ends (frontline expansion).
- **Armies**: big pre-deployed stacks at game start, continuous auto-production from population/economy with a selectable
  production focus (Balanced, Armored, Air Power, Missiles, Air Defense & EW). Units stack; counts shown on pieces.
- **Units**: infantry, IFV, MBT, artillery, SAM, C-UAS, EW jammer, missile launcher, fighter, bomber, attack drone,
  recon drone, loitering munition, frigate + cruise/ballistic missile stockpiles. Drawn as pseudo-3D chess pieces (`src/pieces.ts`).
- **Air/missile/EW rock-paper-scissors**: drones ← C-UAS + jamming; cruise ← SAM + fighters + GPS jamming; ballistic ← only
  SAM L2+ (ABM), unjammable; jets/bombers ← SAM + enemy fighters (escorts help); jamming ← GPS anti-jam upgrades (3 levels);
  recon adds +40% accuracy. EW stations/jammers project visible jamming bubbles. Strike reports show shot/jammed/hit.
- **Buildings (military only)**: army base, airfield, missile site, EW station, SAM site, defense position/outpost.
- **AI**: picks a war target, marches armies to the front, attacks weak regions, strikes concentrations with drones/missiles
  (avoids heavy jamming unless it has anti-jam), builds SAM/EW when threatened, buys anti-jam vs EW-heavy enemies.

## Architecture (multiplayer-ready)
`src/world.ts` + `src/sim.ts` are pure, deterministic (seeded RNG in state, no Date/Math.random/DOM) and serializable.
All changes go through `Command`s (`move`, `strike`, `build`, `focus`, `antijam`, `rush`) applied by `Sim.step(cmds)`.
The full `State` stores the `WorldParams`, so any machine regenerates the identical world and replays commands.
Render/UI (`render.ts`, `pieces.ts`, `icons.ts`, `main.ts`) only read state and emit commands.
Multiplayer plan: authoritative Node server runs the same `Sim`, clients send commands over WebSocket, server stamps a tick and
broadcasts (lockstep) or sends state snapshots; saves double as reconnect snapshots.

## v4 — CoN-style visual overhaul (original art)
Painted land/ocean textures, translucent green (yours) / red (hostile) territory tints, white province borders, red hostile outlines, italic region labels and `City(level)` names, city building textures and map pins, flag-banner unit markers with shadowed 3D-style vehicle sprites, aircraft with ground shadows and red flight paths, light-blue / red air-defense range circles, slate top bar + resource tiles + gold tile, right-side buttons (home, events, advisor, offers), bottom nav, unit action bar (MORE/STOP/PATROL/ATTACK/FERRY/LOADOUT) with info card, and a game-events notification card. Tests: `node tests/v4shots.mjs`, `NOVIDEO=1 node tests/regression.mjs`.
