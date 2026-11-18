// Solmar Bay: a sun-soaked coastal city. Roads on a grid, buildings fill the
// blocks, a park in the middle, a beach and the sea along the south edge.
// The road graph (a node at every intersection) is what traffic drives on.
import { WORLD, PAL } from './config.js';

export const ROAD_W = 64; // vertical avenue width
export const ROAD_H = 56; // horizontal street width
export const AVENUES = [200, 500, 800, 1100, 1400, 1700, 2000, 2300];
export const STREETS = [200, 450, 700, 950, 1200, 1450, 1700];

// Do the rectangles (ax0,ay0)-(ax1,ay1) and b overlap at all?
function overlaps(ax0, ay0, ax1, ay1, b) {
  return ax0 < b.x + b.w && ax1 > b.x && ay0 < b.y + b.h && ay1 > b.y;
}

export function createCity(rng) {
  const buildings = [];
  const trees = [];
  const park = { x: 880, y: 1010, w: 420, h: 170 };
  const lots = []; // open lots where parked cars sit
  const bank = { x: 1150, y: 760, w: 90, h: 60 };
  const depot = { x: 480, y: 1300, w: 120, h: 70 };
  const docks = { x: 2050, y: 1300, w: 180, h: 120 };
  const safehouse = { x: 210, y: 240, w: 90, h: 60 };

  // Buildings: every block between two avenues and two streets gets 1-3
  // rooftops. The park and the docks stay open, and the mission spots (bank,
  // depot, safehouse) are kept clear with a margin, so a pickup or a spawn
  // can never land inside a rooftop. The overlap test is a real rect test —
  // checking only a block's corner lets buildings creep into the lots.
  const keepClear = [
    park,
    docks,
    { x: bank.x - 30, y: bank.y - 30, w: bank.w + 60, h: bank.h + 60 },
    { x: depot.x - 30, y: depot.y - 30, w: depot.w + 60, h: depot.h + 60 },
    { x: safehouse.x - 30, y: safehouse.y - 30, w: safehouse.w + 60, h: safehouse.h + 60 },
  ];
  for (let ai = 0; ai < AVENUES.length - 1; ai++) {
    for (let si = 0; si < STREETS.length - 1; si++) {
      const x0 = AVENUES[ai] + ROAD_W / 2 + 14;
      const x1 = AVENUES[ai + 1] - ROAD_W / 2 - 14;
      const y0 = STREETS[si] + ROAD_H / 2 + 14;
      const y1 = STREETS[si + 1] - ROAD_H / 2 - 14;
      if (overlaps(x0, y0, x1, y1, park) || overlaps(x0, y0, x1, y1, docks)) continue;
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const w = rng.range(70, Math.min(150, (x1 - x0) / n - 8));
        const h = rng.range(55, Math.min(110, y1 - y0 - 16));
        const x = x0 + ((x1 - x0 - w) * (n === 1 ? 0.5 : k / (n - 1 || 1))) + rng.range(-4, 4);
        const y = y0 + rng.range(0, Math.max(0, y1 - y0 - h));
        const bx = Math.min(x, x1 - w);
        const by = y;
        if (keepClear.some((r) => overlaps(bx, by, bx + w, by + h, r))) continue;
        buildings.push({
          x: bx, y: by, w, h,
          color: rng.pick(PAL.buildingRoof),
          roof: rng.pick(['flat', 'ac', 'pool', 'garden']),
          hgt: rng.int(1, 3),
        });
      }
      if (rng.next() < 0.5) {
        lots.push({ x: x0 + rng.range(0, 40), y: y1 - 34, w: 90, h: 26 });
      }
    }
  }

  // Trees in the park and along the beach.
  for (let i = 0; i < 26; i++) {
    trees.push({
      x: park.x + rng.range(15, park.w - 15),
      y: park.y + rng.range(15, park.h - 15),
      r: rng.range(9, 15),
    });
  }
  for (let i = 0; i < 14; i++) {
    trees.push({
      x: rng.range(60, WORLD.w - 60),
      y: WORLD.beachY + rng.range(6, 30),
      r: rng.range(8, 13),
    });
  }

  // Road graph: one node per intersection.
  const nodes = [];
  for (const ax of AVENUES) {
    for (const sy of STREETS) nodes.push({ x: ax, y: sy });
  }
  const nodeAt = (x, y) => nodes.find((n) => n.x === x && n.y === y);

  return {
    buildings, trees, park, lots, bank, depot, docks, safehouse,
    nodes, nodeAt,

    // Is a point on a road (drivable)? Avenues and streets, plus the beach strip.
    onRoad(x, y) {
      if (y > WORLD.beachY) return true;
      for (const ax of AVENUES) if (Math.abs(x - ax) < ROAD_W / 2) return true;
      for (const sy of STREETS) if (Math.abs(y - sy) < ROAD_H / 2) return true;
      return false;
    },

    // Nearest road centre point, used to snap spawns onto roads.
    nearestRoad(x, y) {
      let best = null;
      let bd = 1e9;
      for (const ax of AVENUES) {
        const d = Math.abs(x - ax);
        if (d < bd) { bd = d; best = { x: ax, y }; }
      }
      for (const sy of STREETS) {
        const d = Math.abs(y - sy);
        if (d < bd) { bd = d; best = { x, y: sy }; }
      }
      return best;
    },

    // Circle vs building push-out; returns the corrected point and whether it hit.
    collideCircle(x, y, r) {
      let hit = false;
      for (const b of buildings) {
        const cx = Math.max(b.x, Math.min(x, b.x + b.w));
        const cy = Math.max(b.y, Math.min(y, b.y + b.h));
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          hit = true;
          if (d2 > 0.01) {
            const d = Math.sqrt(d2);
            x = cx + (dx / d) * r;
            y = cy + (dy / d) * r;
          } else {
            x += r;
          }
        }
      }
      if (x < r) { x = r; hit = true; }
      if (x > WORLD.w - r) { x = WORLD.w - r; hit = true; }
      if (y < r) { y = r; hit = true; }
      if (y > WORLD.h - r) { y = WORLD.h - r; hit = true; }
      return { x, y, hit };
    },
  };
}

// A point on a sidewalk (beside a road, not on it) — where pedestrians walk.
export function sidewalkPoint(rng, city) {
  const ax = rng.pick(AVENUES);
  const sy = rng.pick(STREETS);
  if (rng.next() < 0.5) {
    return {
      x: ax + (rng.next() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12),
      y: rng.range(60, WORLD.beachY - 40),
    };
  }
  return {
    x: rng.range(60, WORLD.w - 60),
    y: sy + (rng.next() < 0.5 ? -1 : 1) * (ROAD_H / 2 + 12),
  };
}
