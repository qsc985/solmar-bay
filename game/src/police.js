// The wanted system: heat builds with crimes and cools when quiet; police cars spawn at
// the city's edge and hunt the player, ramming to stop them. Busted only when health runs out.
import { WANTED_MAX, HEAT_PER_STAR, HEAT_DECAY, CRIME_CAR_THEFT } from './config.js';
import { makeCar } from './cars.js';
import { clamp, angleDiff } from './random.js';

export function createWanted() {
  return { heat: 0, quietT: 0, stars: 0, bustedT: 0 };
}
export function starsOf(wanted) { return clamp(Math.ceil(wanted.heat / HEAT_PER_STAR), 0, WANTED_MAX); }
export function addCrime(wanted, heat) {
  wanted.heat = clamp(wanted.heat + heat, 0, WANTED_MAX * HEAT_PER_STAR);
  wanted.quietT = 0;
  wanted.stars = starsOf(wanted);
}
export function updateWanted(wanted, dt, policeNear) {
  wanted.quietT += dt;
  if (wanted.quietT > 8 && !policeNear && wanted.heat > 0) {
    wanted.heat = Math.max(0, wanted.heat - HEAT_DECAY * dt * 6);
    wanted.stars = starsOf(wanted);
  }
}

// Spawn police cars just off the player's view, at the edge of the city.
export function spawnPolice(rng, city, px, py, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const edge = rng.pick(['n', 's', 'e', 'w']);
    let x = px, y = py;
    if (edge === 'n') { x = clamp(px + rng.range(-500, 500), 100, 2500); y = clamp(py - 620, 60, 1700); }
    if (edge === 's') { x = clamp(px + rng.range(-500, 500), 100, 2500); y = clamp(py + 620, 60, 1700); }
    if (edge === 'e') { x = clamp(px + 620, 100, 2500); y = clamp(py + rng.range(-500, 500), 60, 1700); }
    if (edge === 'w') { x = clamp(px - 620, 100, 2500); y = clamp(py + rng.range(-500, 500), 60, 1700); }
    const p = city.nearestRoad(x, y);
    const car = makeCar('police', p.x, p.y, Math.atan2(py - p.y, px - p.x));
    car.speed = 200;
    out.push(car);
  }
  return out;
}

// A police car chases the player: steer hard, ram, and keep pace with faster cars.
export function updatePoliceCar(car, px, py, dt, city) {
  const want = Math.atan2(py - car.y, px - car.x);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -3.4 * dt, 3.4 * dt);
  const d = Math.hypot(px - car.x, py - car.y);
  const targetSpeed = d > 420 ? 480 : 430;
  car.speed += clamp(targetSpeed - car.speed, -320 * dt, 260 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const c = city.collideCircle(car.x, car.y, 20);
  if (c.hit) { car.x = c.x; car.y = c.y; car.speed *= 0.6; }
  return d;
}

export { CRIME_CAR_THEFT };
