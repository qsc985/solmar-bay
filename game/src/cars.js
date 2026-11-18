// Cars: arcade physics (accelerate, steer, drift), traffic that follows the
// road graph, and the collisions that keep them honest.
import { CAR_TYPES, TRAFFIC_SPEED } from './config.js';
import { clamp, angleDiff, dist2 } from './random.js';
import { AVENUES, STREETS } from './city.js';

let nextId = 1;

export function makeCar(type, x, y, angle, opts = {}) {
  const t = CAR_TYPES[type];
  return {
    id: nextId++,
    type, x, y, angle,
    speed: 0,
    len: t.len, wid: t.wid, accel: t.accel, top: t.top, grip: t.grip,
    color: opts.color ?? t.color,
    health: 100,
    traffic: !!opts.traffic,
    parked: !!opts.parked,
    target: opts.target ?? null, // traffic: the next intersection node
    siren: type === 'police',
    smoke: 0,
    dead: false,
    driver: opts.driver ?? (opts.traffic ? 'traffic' : null),
  };
}

export function spawnTrafficCar(rng, city) {
  const ax = rng.pick(AVENUES);
  const sy = rng.pick(STREETS);
  const type = rng.pick(['sedan', 'sedan', 'taxi', 'van', 'truck', 'sedan']);
  const horizontal = rng.next() < 0.5;
  const x = horizontal ? rng.range(80, 2500) : ax + (rng.next() < 0.5 ? -14 : 14);
  const y = horizontal ? sy + (rng.next() < 0.5 ? -13 : 13) : rng.range(80, 1700);
  const angle = horizontal
    ? (rng.next() < 0.5 ? 0 : Math.PI)
    : (rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
  const car = makeCar(type, x, y, angle, { traffic: true });
  car.speed = TRAFFIC_SPEED * rng.range(0.8, 1.1);
  car.target = nearestNode(city, car.x, car.y);
  return car;
}

function nearestNode(city, x, y) {
  let best = null;
  let bd = 1e12;
  for (const n of city.nodes) {
    const d = dist2(x, y, n.x, n.y);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

// Drive one traffic car: steer toward its target node, pick a new one on arrival.
export function updateTraffic(car, dt, rng, city, cars, peds) {
  if (!car.target) {
    car.target = nearestNode(city, car.x, car.y);
    return;
  }
  const dx = car.target.x - car.x;
  const dy = car.target.y - car.y;
  const want = Math.atan2(dy, dx);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);

  // Slow for a car ahead on the same road.
  let ahead = 1;
  for (const o of cars) {
    if (o === car || o.parked) continue;
    const ddx = o.x - car.x;
    const ddy = o.y - car.y;
    const along = ddx * Math.cos(car.angle) + ddy * Math.sin(car.angle);
    const side = Math.abs(-ddx * Math.sin(car.angle) + ddy * Math.cos(car.angle));
    if (along > 0 && along < 70 && side < 26) ahead = Math.min(ahead, along / 70);
  }
  // Stop for a pedestrian in the way. Brake early: at traffic speed the car
  // needs ~60 units to stop, so the slowdown starts well out and brings it
  // to a halt about 30 units short — traffic must not be a massacre.
  if (peds) {
    for (const p of peds) {
      if (p.down) continue;
      const ddx = p.x - car.x;
      const ddy = p.y - car.y;
      const along = ddx * Math.cos(car.angle) + ddy * Math.sin(car.angle);
      const side = Math.abs(-ddx * Math.sin(car.angle) + ddy * Math.cos(car.angle));
      if (along > 0 && along < 130 && side < 24) {
        ahead = Math.min(ahead, Math.max(0, (along - 30) / 80));
        if (along < 45) {
          ahead = 0;
          break;
        }
      }
    }
  }
  const targetSpeed = TRAFFIC_SPEED * ahead;
  car.speed += clamp(targetSpeed - car.speed, -260 * dt, 180 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  if (dist2(car.x, car.y, car.target.x, car.target.y) < 30 * 30) {
    // At an intersection: mostly straight, sometimes a turn.
    const r = rng.next();
    const dirs = [0, Math.PI / 2, -Math.PI / 2, Math.PI];
    const cur = Math.round(car.angle / (Math.PI / 2)) % 4;
    const turn = r < 0.68 ? 0 : r < 0.84 ? 1 : r < 0.94 ? -1 : 2;
    const next = ((cur + turn) % 4 + 4) % 4;
    const a = dirs[next];
    // Step one block along the new heading to the next intersection.
    const stepX = Math.abs(Math.cos(a)) > 0.5 ? (Math.cos(a) > 0 ? 300 : -300) : 0;
    const stepY = Math.abs(Math.sin(a)) > 0.5 ? (Math.sin(a) > 0 ? 250 : -250) : 0;
    const nx = clamp(car.target.x + stepX, 200, 2300);
    const ny = clamp(car.target.y + stepY, 200, 1700);
    car.target = city.nodeAt(nx, ny) ?? { x: nx, y: ny };
  }
}

// Player driving: throttle, brake/reverse, steering that bites harder at
// speed, and drift.
export function updateDriven(car, input, dt, audio) {
  const axis = input.axis();
  const throttle = axis.y < 0 ? 1 : 0; // W / Up
  const brake = axis.y > 0 ? 1 : 0; // S / Down
  const steer = axis.x; // A / D
  if (throttle) car.speed += car.accel * dt;
  if (brake) car.speed -= (car.speed > 0 ? 560 : 300) * dt;
  if (!throttle && !brake) car.speed -= Math.sign(car.speed) * 140 * dt;
  if (Math.abs(car.speed) < 4 && !throttle && !brake) car.speed = 0;
  car.speed = clamp(car.speed, -car.top * 0.45, car.top);
  // Steering authority grows with speed but never drops to zero: the 0.15
  // floor is a creep-turn, so a stopped car still pivots slowly. Without it
  // a car that loses all speed mid-turn can never steer again (steering needs
  // speed, speed needs throttle, and a driver waiting for the turn holds
  // neither) and wedges against the corner forever.
  const steerAuthority = clamp(Math.abs(car.speed) / 140, 0.15, 1) * 2.6;
  car.angle += steer * steerAuthority * Math.sign(car.speed || 1) * dt * (car.speed >= 0 ? 1 : -1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const drifting = Math.abs(steer) > 0.4 && Math.abs(car.speed) > 260;
  if (audio) audio.engine(Math.abs(car.speed) / car.top);
  return { drifting, speed: car.speed };
}

// Circle-ish collision between two cars: push apart, trade a little speed, spark.
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minD = (a.len + b.len) / 2 - 8;
  const d2 = dx * dx + dy * dy;
  if (d2 >= minD * minD || d2 < 0.01) return false;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const overlap = (minD - d) / 2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;
  const impact = Math.abs(a.speed - b.speed);
  a.speed *= 0.86;
  b.speed *= 0.86;
  if (impact > 120) {
    a.health -= 6;
    b.health -= 6;
    return true;
  }
  return false;
}
