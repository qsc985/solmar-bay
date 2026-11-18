// Cars: creation, driving physics, traffic AI, collisions and damage.
// A car is a circle-ish body with an angle and a speed along its heading.

import { CAR_TYPES } from './config.js';
import { clamp, angleDiff } from './random.js';
import { collideCircle, hitsBuilding, onRoad, randomRoadPoint } from './city.js';

let nextId = 1;

export function createCar(type, x, y, angle = 0, opts = {}) {
  const def = CAR_TYPES[type];
  return {
    id: nextId++,
    type,
    name: opts.name ?? def.name,
    x, y,
    angle,
    speed: 0,
    health: def.health,
    maxHealth: def.health,
    color: opts.color ?? def.color,
    traffic: opts.traffic ?? false, // AI traffic (follows roads)
    parked: opts.parked ?? false, // parked and enterable
    police: type === 'police',
    driver: null, // 'player' when the player drives it
    dead: false,
    routeAxis: opts.routeAxis ?? null, // 'h' | 'v' for traffic
    routeLine: opts.routeLine ?? 0,
    routeDir: opts.routeDir ?? 1,
    stuck: 0,
    sirenT: 0,
  };
}

// Driving: W/S accelerate and brake/reverse, A/D steer. Steering keeps a minimum
// authority at low speed so the car can still turn out of a tight spot.
export function driveCar(G, car, input, dt) {
  const def = CAR_TYPES[car.type];
  const fwd = input.keys.has('KeyW') || input.keys.has('ArrowUp');
  const back = input.keys.has('KeyS') || input.keys.has('ArrowDown');
  const left = input.keys.has('KeyA') || input.keys.has('ArrowLeft');
  const right = input.keys.has('KeyD') || input.keys.has('ArrowRight');
  if (fwd) car.speed += def.accel * dt;
  else if (back) car.speed -= def.accel * 0.9 * dt;
  else {
    // Rolling resistance.
    car.speed -= Math.sign(car.speed) * 130 * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = clamp(car.speed, -90, def.maxSpeed);
  // Steering authority: at least 0.15 even standing still, full by 150 px/s.
  const authority = 0.15 + 0.85 * Math.min(1, Math.abs(car.speed) / 150);
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  if (steer !== 0 && car.speed !== 0) {
    car.angle += steer * def.turn * authority * Math.sign(car.speed) * dt;
  }
  moveCar(G, car, dt);
}

// Move a car by its speed and angle, resolving building and car collisions.
export function moveCar(G, car, dt) {
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const before = { x: car.x, y: car.y };
  const c = collideCircle(G.city, nx, ny, 15);
  car.x = c.x;
  car.y = c.y;
  // A hard wall hit scrubs speed and dents the car.
  if (Math.hypot(car.x - before.x, car.y - before.y) < Math.abs(car.speed) * dt * 0.4) {
    if (Math.abs(car.speed) > 120) damageCar(G, car, 6, null);
    car.speed *= 0.45;
  }
  // Car-to-car: push apart, trade a little speed, dent on hard hits.
  for (const o of G.cars) {
    if (o === car || o.dead) continue;
    const dx = car.x - o.x;
    const dy = car.y - o.y;
    const d = Math.hypot(dx, dy);
    const min = 30;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      car.x += ux * push;
      car.y += uy * push;
      o.x -= ux * push;
      o.y -= uy * push;
      const impact = Math.abs(car.speed - o.speed);
      if (impact > 90) {
        damageCar(G, car, 5, null);
        damageCar(G, o, 5, null);
      }
      car.speed *= 0.92;
    }
  }
}

export function damageCar(G, car, dmg, src) {
  if (car.dead) return;
  car.health -= dmg;
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    car.speed = 0;
    if (G && G.addParticles) G.addParticles(car.x, car.y, 'smoke', 14);
    if (G && G.audio) G.audio.crash();
    // A wrecked car ejects its driver.
    if (car.driver === 'player' && G.player) {
      G.player.car = null;
      car.driver = null;
    }
  }
}

// Traffic AI: follow the road grid, turn at intersections sometimes, and stop
// for the car ahead so the streets don't jam.
export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (!car.traffic || car.dead) continue;
    const def = CAR_TYPES[car.type];
    // At an intersection, sometimes turn onto the crossing road.
    const nearH = G.city.roadsH.find((ry) => Math.abs(car.y - ry) < 26);
    const nearV = G.city.roadsV.find((rx) => Math.abs(car.x - rx) < 26);
    if (car.routeAxis === 'h' && nearV !== undefined && Math.abs(car.x - nearV) < 20 && G.rng.chance(dt * 0.25)) {
      car.routeAxis = 'v';
      car.routeLine = nearV;
      car.routeDir = G.rng.chance(0.5) ? 1 : -1;
    } else if (car.routeAxis === 'v' && nearH !== undefined && Math.abs(car.y - nearH) < 20 && G.rng.chance(dt * 0.25)) {
      car.routeAxis = 'h';
      car.routeLine = nearH;
      car.routeDir = G.rng.chance(0.5) ? 1 : -1;
    }
    // Steer toward the route line.
    const targetAngle = car.routeAxis === 'h'
      ? (car.routeDir > 0 ? 0 : Math.PI)
      : (car.routeDir > 0 ? Math.PI / 2 : -Math.PI / 2);
    let want = angleDiff(car.angle, targetAngle);
    car.angle += clamp(want, -1.6 * dt, 1.6 * dt);
    // Ease back onto the line.
    if (car.routeAxis === 'h') car.y += (car.routeLine - car.y) * Math.min(1, dt * 1.2);
    else car.x += (car.routeLine - car.x) * Math.min(1, dt * 1.2);
    // Slow for the car ahead.
    let ahead = Infinity;
    for (const o of G.cars) {
      if (o === car || o.dead) continue;
      const dx = o.x - car.x;
      const dy = o.y - car.y;
      const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along > 0 && along < 90 && side < 26) ahead = Math.min(ahead, along);
    }
    const cruise = def.maxSpeed * 0.45;
    const targetSpeed = ahead < 70 ? 0 : cruise;
    car.speed += clamp(targetSpeed - car.speed, -260 * dt, 180 * dt);
    moveCar(G, car, dt);
    // Turn around at the map edge instead of driving into the sea.
    if (car.x < 60 || car.x > 2340 || car.y < 60 || car.y > 1620) {
      car.routeDir *= -1;
      car.angle += Math.PI;
    }
  }
}

// Spawn a traffic car on a road, away from the player.
export function spawnTraffic(G, x, y) {
  const types = ['sedan', 'sedan', 'taxi', 'truck', 'sports'];
  const type = G.rng.pick(types);
  const horizontal = G.rng.chance(0.5);
  const line = horizontal ? G.rng.pick(G.city.roadsH) : G.rng.pick(G.city.roadsV);
  const px = horizontal ? x : line;
  const py = horizontal ? line : y;
  const car = createCar(type, px, py, horizontal ? (G.rng.chance(0.5) ? 0 : Math.PI) : (G.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2), {
    traffic: true,
    routeAxis: horizontal ? 'h' : 'v',
    routeLine: line,
    routeDir: G.rng.chance(0.5) ? 1 : -1,
  });
  car.speed = CAR_TYPES[type].maxSpeed * 0.4;
  return car;
}

// A parked car in a lot or at the kerb.
export function spawnParked(G, x, y, type, angle = 0) {
  return createCar(type, x, y, angle, { parked: true });
}

export { randomRoadPoint, onRoad, hitsBuilding };
