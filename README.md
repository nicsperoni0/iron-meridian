# Iron Meridian v2 — air, missiles & electronic warfare (mobile strategy prototype)

Original game (no third-party art/names/assets). TypeScript + Vite + Canvas 2D, installable PWA.
Live: https://nicsperoni0.github.io/iron-meridian/

    npm install && npm run build        # dist/ (postbuild stamps a new service-worker cache id)
    python3 -m http.server 8787 -d dist
    node tests/v2.mjs                   # Playwright @390x844: worldgen 0%/100%, armies, roads, strikes vs SAM/EW, AI, save/load
    npm run map                         # rebuild public/world2.json from Natural Earth (data/)

## What's in v2
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
