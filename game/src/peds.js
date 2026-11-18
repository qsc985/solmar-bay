// Pedestrians: ordinary walkers on the sidewalks, and the Viper gang at the docks.
// Walkers flee from gunfire; gang members stand their ground and shoot back.

import { clamp } from './random.js';
import { collideCircle } from './city.js';

const SHIRTS = ['#e8e8e8', '#f2c14e', '#7fb069', '#e07a5f', '#81b29a', '#f4a261', '#b5838d', '#6d9dc5'];

export function createPed(x, y, opts = {}) {
  return {
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 0,
    health: 100,
    down: false,
    gang: opts.gang ?? false,
    state: opts.gang ? 'guard' : 'walk',
    color: opts.color ?? SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
    // Walkers wander between sidewalk waypoints; gang members hold a post.
    wx: x, wy: y,
    wait: 0,
    shootCd: 0,
    flee: 0,
  };
}

export function spawnWalkers(G, n) {
  for (let i = 0; i < n; i++) {
    const p = randomSidewalkPoint(G);
    if (!p) continue;
    G.peds.push(createPed(p.x, p.y));
  }
}

function randomSidewalkPoint(G) {
  for (let tries = 0; tries < 12; tries++) {
    const x = G.rng.range(80, 2320);
    const y = G.rng.range(80, 1600);
    // Sidewalks run beside roads: near a road but not on it.
    const nearH = G.city.roadsH.some((ry) => Math.abs(y - ry) > 34 && Math.abs(y - ry) < 70);
    const nearV = G.city.roadsV.some((rx) => Math.abs(x - rx) > 34 && Math.abs(x - rx) < 70);
    if (!nearH && !nearV) continue;
    return { x, y };
  }
  return null;
}

// The Viper gang: four members posted around the docks.
export function spawnGang(G, cx, cy) {
  const spots = [
    { x: cx - 60, y: cy - 40 },
    { x: cx + 40, y: cy - 70 },
    { x: cx + 90, y: cy + 30 },
    { x: cx - 20, y: cy + 80 },
  ];
  for (const s of spots) {
    const g = createPed(s.x, s.y, { gang: true, color: '#8e2f32' });
    g.state = 'guard';
    G.peds.push(g);
  }
}

export function updatePeds(G, dt) {
  const P = G.player;
  for (const p of G.peds) {
    if (p.down) continue;
    p.shootCd = Math.max(0, p.shootCd - dt);
    p.wait = Math.max(0, p.wait - dt);
    p.flee = Math.max(0, p.flee - dt);
    if (p.gang) {
      updateGang(G, p, dt);
      continue;
    }
    // Flee from nearby gunfire or a speeding car.
    const threat = G.shotsFiredAt > 0 && Math.hypot(p.x - P.x, p.y - P.y) < 260;
    if (threat) p.flee = 2.5;
    if (p.flee > 0) {
      const away = Math.atan2(p.y - P.y, p.x - P.x);
      p.angle = away;
      p.x += Math.cos(away) * 130 * dt;
      p.y += Math.sin(away) * 130 * dt;
    } else if (p.wait <= 0) {
      // Wander to a nearby sidewalk point.
      if (Math.hypot(p.wx - p.x, p.wy - p.y) < 12) {
        const np = randomSidewalkPoint(G);
        if (np) { p.wx = np.x; p.wy = np.y; }
        p.wait = G.rng.range(0.5, 3);
      } else {
        p.angle = Math.atan2(p.wy - p.y, p.wx - p.x);
        p.x += Math.cos(p.angle) * 42 * dt;
        p.y += Math.sin(p.angle) * 42 * dt;
      }
    }
    const c = collideCircle(G.city, p.x, p.y, 10);
    p.x = c.x;
    p.y = c.y;
  }
  // Prune the dead far from the player so the array stays small.
  if (G.peds.length > 90) {
    G.peds = G.peds.filter((p) => !p.down || Math.hypot(p.x - P.x, p.y - P.y) < 700);
  }
}

function updateGang(G, g, dt) {
  const P = G.player;
  const d = Math.hypot(P.x - g.x, P.y - g.y);
  g.state = d < 420 ? 'fight' : 'guard';
  if (g.state === 'fight') {
    g.angle = Math.atan2(P.y - g.y, P.x - g.x);
    // Strafe a little so they are not standing targets.
    g.x += Math.cos(g.angle + Math.PI / 2) * Math.sin(G.time * 1.3 + g.y) * 14 * dt;
    g.y += Math.sin(g.angle + Math.PI / 2) * Math.sin(G.time * 1.3 + g.y) * 14 * dt;
    if (d < 380 && g.shootCd <= 0) {
      g.shootCd = 1.8;
      // Gang fire is wild: a spread shot at the player.
      G.fireBullet(g.x, g.y, g.angle + (G.rng.next() - 0.5) * 0.35, 'gang', 2);
    }
  }
}

export function damagePed(G, ped, dmg) {
  if (ped.down) return;
  ped.health -= dmg;
  ped.flee = 2;
  if (ped.health <= 0) {
    ped.health = 0;
    ped.down = true;
    G.addFloat(ped.x, ped.y - 18, 'DOWN', '#ff5a5a');
    if (ped.gang) G.addParticles(ped.x, ped.y, 'blood', 10);
  }
}

export { clamp };
