// Pedestrians: they stroll the sidewalks, chat in place, and run when scared.
// Gang members are armed peds that hold a spot and shoot at the player.
import { sidewalkPoint } from './city.js';
import { clamp, angleDiff } from './random.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8'];
let nextId = 1;

export function makePed(rng, city, opts = {}) {
  const p = sidewalkPoint(rng, city);
  return {
    id: nextId++, x: opts.x ?? p.x, y: opts.y ?? p.y,
    angle: rng.range(0, Math.PI * 2), speed: 0,
    shirt: rng.pick(SHIRTS), skin: rng.pick(['#f1c27d', '#e0ac69', '#c68642', '#8d5524']),
    state: 'walk', // walk | idle | flee | down | gang
    target: null, wait: rng.range(0, 4), health: 100,
    gang: !!opts.gang, gun: !!opts.gang, shootCd: rng.range(0.5, 1.5),
    down: false, fleeT: 0,
  };
}

export function updatePeds(peds, dt, rng, city, danger) {
  for (const p of peds) {
    if (p.down) continue;
    if (p.gang) { updateGang(p, dt, danger); continue; }
    // Flee from gunfire or a speeding car nearby.
    if (danger.near(p.x, p.y, 130)) {
      p.state = 'flee'; p.fleeT = 2.2;
    }
    if (p.state === 'flee') {
      p.fleeT -= dt;
      const a = Math.atan2(p.y - danger.y, p.x - danger.x);
      p.angle += angleDiff(p.angle, a) * Math.min(1, 8 * dt);
      p.speed = 200;
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      const c = city.collideCircle(p.x, p.y, 10);
      p.x = c.x; p.y = c.y;
      if (p.fleeT <= 0) p.state = 'walk';
      continue;
    }
    p.wait -= dt;
    if (p.state === 'idle') {
      if (p.wait <= 0) { p.state = 'walk'; p.target = sidewalkPoint(rng, city); }
      continue;
    }
    if (!p.target) { p.target = sidewalkPoint(rng, city); continue; }
    const dx = p.target.x - p.x, dy = p.target.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) { p.state = 'idle'; p.wait = rng.range(2, 7); p.speed = 0; continue; }
    const want = Math.atan2(dy, dx);
    p.angle += angleDiff(p.angle, want) * Math.min(1, 6 * dt);
    p.speed = 52;
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    p.x = clamp(p.x, 20, 2580); p.y = clamp(p.y, 20, 1880);
  }
}

function updateGang(p, dt, danger) {
  // Gang members stand their ground and shoot at the player when close.
  const d = Math.hypot(danger.px - p.x, danger.py - p.y);
  if (d < 420 && danger.alive) {
    p.angle += angleDiff(p.angle, Math.atan2(danger.py - p.y, danger.px - p.x)) * Math.min(1, 5 * dt);
    p.shootCd -= dt;
    if (p.shootCd <= 0) {
      p.shootCd = 2.0 + Math.random() * 1.2;
      danger.shootFrom(p);
    }
  }
}
