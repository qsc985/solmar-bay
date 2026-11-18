# SOLMAR BAY

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/qsc985/solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/qsc985/solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, built for the make.fun gta6-01 bounty. You are Danny Reyes, new to the fictional coastal city of Solmar Bay. Drive a taxi, run packages, steal a Comet GT, take on the Viper gang, and pull the big bank job — five story missions, $2,200 on the line.

## How to play

```
node serve.ts
```

Then open http://localhost:8080/ in a desktop browser.

- **WASD / arrows** — walk and drive (Shift to run)
- **E** — enter / steal a car, get out, pick up the package, grab the bank cash
- **Mouse** — aim, click to shoot (drive-by shooting works from a car)
- **R** — reload, **M** — mute

## The city

A seeded open world (2400×1800): a road grid with traffic and pedestrians, parking lots, a beach and the sea, the docks and the pier, the Solmar Bank and a safehouse. Cars to steal, a wanted level with police cruisers that chase and shoot back, a HUD with cash, health, wanted stars and a live minimap, and a localStorage save.

## The story

1. **Taxi Driver ($150)** — drive a fare to the pier.
2. **The Package ($200)** — carry a package to the docks on foot.
3. **Grand Theft ($350)** — steal the red Comet GT and lose a 3-star heat.
4. **Viper Hunt ($500)** — drop all four Vipers at the docks.
5. **The Big Score ($1,000)** — rob the bank at 4 stars and reach the safehouse.

Finish all five and free-roam Solmar Bay with the heat cleared.

## Build

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Everything in `game/` is plain static files — no build step, no network requests. All art is drawn on canvas and all sound is synthesised with WebAudio.
