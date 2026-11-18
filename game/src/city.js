// The city of Solmar Bay: a road grid, buildings inside the blocks, trees, parking
// lots, the beach and the sea. Generation is seeded, so the same seed always builds
// the same city. Fixed story spots (taxi, Comet GT, pier, bank, safehouse) are kept
// clear of buildings.

import { WORLD_W, WORLD_H, ROADS_H, ROADS_V, ROAD_HALF, SEA_Y, BEACH_Y, PAL, TAXI_SPOT, COMET_SPOT, PIER, DOCKS, BANK_SPOT, SAFEHOUSE, PACKAGE_SPOT } from './config.js';
import { makeRng, clamp } from './random.js';

// Places nothing may be built on top of (x, y, keep-clear radius).
const CLEARINGS = [
  { ...TAXI_SPOT, r: 90 },
  { ...COMET_SPOT, r: 90 },
  { ...PIER, r: 130 },
  { ...DOCKS, r: 150 },
  { ...BANK_SPOT, r: 110 },
  { ...SAFEHOUSE, r: 110 },
  { ...PACKAGE_SPOT, r: 90 },
];

function nearClearing(x, y, pad = 0) {
  for (const c of CLEARINGS) {
    if (Math.hypot(x - c.x, y - c.y) < c.r + pad) return true;
  }
  return false;
}

export function createCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const lots = [];

  // Buildings live inside the blocks between roads. Each block gets 0-3 buildings.
  for (let hi = 0; hi < ROADS_H.length - 1; hi++) {
    for (let vi = 0; vi < ROADS_V.length - 1; vi++) {
      const x0 = ROADS_V[vi] + ROAD_HALF + 14;
      const x1 = ROADS_V[vi + 1] - ROAD_HALF - 14;
      const y0 = ROADS_H[hi] + ROAD_HALF + 14;
      const y1 = ROADS_H[hi + 1] - ROAD_HALF - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // The south strip is beach; the docks block stays open.
      if (y0 > BEACH_Y - 40) continue;
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const w = rng.range(60, Math.min(150, x1 - x0 - 20));
        const h = rng.range(50, Math.min(120, y1 - y0 - 20));
        const x = rng.range(x0, x1 - w);
        const y = rng.range(y0, y1 - h);
        const cx = x + w / 2;
        const cy = y + h / 2;
        if (nearClearing(cx, cy, 30)) continue;
        // Keep buildings from overlapping each other in the same block.
        let clash = false;
        for (const b of buildings) {
          if (x < b.x + b.w + 18 && x + w + 18 > b.x && y < b.y + b.h + 18 && y + h + 18 > b.y) { clash = true; break; }
        }
        if (clash) continue;
        const ci = rng.int(0, PAL.building.length - 1);
        buildings.push({ x, y, w, h, color: PAL.building[ci], roof: PAL.roof[ci] });
      }
      // A few trees per block.
      const tn = rng.int(1, 4);
      for (let k = 0; k < tn; k++) {
        const tx = rng.range(x0, x1);
        const ty = rng.range(y0, y1);
        if (nearClearing(tx, ty, 10)) continue;
        trees.push({ x: tx, y: ty, r: rng.range(9, 15) });
      }
    }
  }

  // Parking lots: flat asphalt pads with marked bays, placed inside wide blocks.
  const lotSpots = [
    { x: 1650, y: 660, w: 110, h: 80 }, // the Comet GT's lot
    { x: 1150, y: 240, w: 130, h: 70 },
    { x: 600, y: 1450, w: 130, h: 70 },
    { x: 1850, y: 1060, w: 120, h: 80 },
  ];
  for (const l of lotSpots) lots.push({ ...l, bays: 5 });

  return {
    seed,
    roadsH: ROADS_H.slice(),
    roadsV: ROADS_V.slice(),
    buildings,
    trees,
    lots,
    worldW: WORLD_W,
    worldH: WORLD_H,
    seaY: SEA_Y,
    beachY: BEACH_Y,
  };
}

// Is (x, y) on a road (within the asphalt, plus a small shoulder)?
export function onRoad(city, x, y) {
  for (const ry of city.roadsH) if (Math.abs(y - ry) <= ROAD_HALF + 6) return true;
  for (const rx of city.roadsV) if (Math.abs(x - rx) <= ROAD_HALF + 6) return true;
  return false;
}

// Nearest point on any road centreline to (x, y).
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bd = Infinity;
  for (const ry of city.roadsH) {
    const d = Math.abs(y - ry);
    if (d < bd) { bd = d; best = { x: clamp(x, 0, WORLD_W), y: ry }; }
  }
  for (const rx of city.roadsV) {
    const d = Math.abs(x - rx);
    if (d < bd) { bd = d; best = { x: rx, y: clamp(y, 0, WORLD_H) }; }
  }
  return best;
}

// Circle-vs-building collision: slide the circle out of any building it overlaps.
// Also clamps to the world and treats the sea as solid for cars and feet alike
// (the pier area is reached on the docks, not by swimming).
export function collideCircle(city, x, y, r, allowSea = false) {
  let nx = clamp(x, r, WORLD_W - r);
  let ny = clamp(y, r, WORLD_H - r);
  for (const b of city.buildings) {
    const cx = clamp(nx, b.x, b.x + b.w);
    const cy = clamp(ny, b.y, b.y + b.h);
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 === 0) { nx = b.x - r; continue; }
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * r;
      ny = cy + (dy / d) * r;
    }
  }
  if (!allowSea && ny + r > city.seaY) ny = city.seaY - r;
  return { x: nx, y: ny };
}

// Does a circle at (x, y, r) touch any building?
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return b;
  }
  return null;
}

// A random road point for spawning traffic / police, at least `minDist` from (x, y).
export function randomRoadPoint(city, rng, x, y, minDist = 400) {
  for (let tries = 0; tries < 20; tries++) {
    const horizontal = rng.chance(0.5);
    let px;
    let py;
    if (horizontal) {
      py = rng.pick(city.roadsH);
      px = rng.range(60, WORLD_W - 60);
    } else {
      px = rng.pick(city.roadsV);
      py = rng.range(60, Math.min(WORLD_H - 60, city.seaY - 80));
    }
    if (Math.hypot(px - x, py - y) >= minDist) return { x: px, y: py };
  }
  return { x: 100, y: 100 };
}
