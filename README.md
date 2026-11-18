[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/qsc985/solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/qsc985/solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# SOLMAR BAY — an open-world crime story

A top-down 2D open-world crime game for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). You are Danny Reyes, a driver for hire in Solmar Bay, working off a debt to the fixer Lena Cruz. Five jobs, then the city is yours.

## The story

1. **First Fare** — drive the taxi from the depot to the pier.
2. **The Package** — walk a package to the docks, on foot, no attention.
3. **Hot Wheels** — steal the red Comet GT from the showroom lot, then lose the cops.
4. **Payback** — four Vipers jumped one of Lena's drivers at the docks. Make it even.
5. **The Big Score** — Solmar Bank at noon. Grab the bag, reach the safehouse.

Finish all five and free roam opens: taxi fares pay the rent.

## The city

A 2600×1900 grid city — 8 avenues × 7 streets, a park, a beach and the sea — with traffic that follows the road graph, pedestrians who stroll the sidewalks and flee gunfire, police who spawn at the city edge and ram you off the road, and a wanted system (stars cool off after 8 quiet seconds).

## Controls

- **WASD / arrows** — walk or drive (Shift to run)
- **Mouse** — aim · **Click** — shoot · **R** — reload
- **E** — enter / steal a car, pick up a package · **Esc** — pause · **M** — mute

## Play it

No build step, no network at run time — the game is plain static files under `game/`:

```sh
node serve.ts            # http://localhost:8080
```

Or open `game/index.html` through any static server. `?seed=N` fixes the city layout; `?debug=1` exposes `window.__solmar` for automated playtests.

## Build the dossier

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

This copies `game/` and `screenshots/` into `out/` and writes `out/dossier.json` (schema `makefun/dossier/v1`) with the 4 staged screenshots from `shots.json` (`?shot=start|drive|chase|mission&seed=1`).

## Tech

- ES modules, Canvas 2D, WebAudio (all sound synthesized — no audio files)
- Node 22 stdlib only for the entrypoint (`main.ts`) and dev server (`serve.ts`)
- Deterministic: `?seed=N` reproduces the same city, traffic and pedestrians
