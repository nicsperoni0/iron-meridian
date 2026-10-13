# Iron Meridian — modern-day mobile strategy (prototype)

Original game inspired by the *feel* of grand-strategy war games (no third-party art, names or assets).
TypeScript + Vite, Canvas 2D renderer, installable PWA.

    npm install && npm run build      # outputs dist/
    npm run dev                        # local dev server
    python3 -m http.server 8787 -d dist   # serve the build
    node tests/e2e.mjs                 # Playwright phone-viewport smoke test (expects server on :8787)
    npm run map                        # rebuild public/world.json from data/prov.topo.json

Map: Natural Earth 10m admin-1 (public domain), dissolved/simplified with mapshaper to 2,645 provinces / 194 countries.

## Architecture (multiplayer-ready)
- `src/sim.ts` — the whole game rules: deterministic (seeded mulberry32 RNG stored in state, no Date/Math.random,
  no DOM), state is a plain JSON object (`State`), and it only changes through `Command`s
  (`build`, `train`, `move`) applied at tick boundaries by `Sim.step(commands)`.
- `src/render.ts`, `src/icons.ts`, `src/main.ts` — presentation and input only; they read state and emit commands.

Multiplayer plan: run `Sim` on a Node server (authoritative), clients send commands over WebSocket, server
stamps each with a tick and broadcasts; clients either receive state snapshots/deltas or run lockstep using
the same commands + seed. Save/load already serializes the full `State` (localStorage), which doubles as a
snapshot format for reconnects.
