// The wanted system: heat builds when the player steals or shoots, police cruisers
// spawn and chase, and heat bleeds off once the cops lose the player. Heat decays
// fast when no cruiser is close and slowly while one is — so losing the cops is
// always possible, but never instant.

import { createCar, damageCar } from './cars.js';
import { randomRoadPoint } from './city.js';
import { clamp } from './random.js';

export function createWanted() {
  return { heat: 0, stars: 0 };
}

export function setWanted(G, stars) {
  G.wanted.heat = clamp(stars, 0, 5);
  G.wanted.stars = Math.round(G.wanted.heat);
}

export function addHeat(G, amount) {
  G.wanted.heat = clamp(G.wanted.heat + amount, 0, 5);
  G.wanted.stars = Math.round(G.wanted.heat);
}

export function updateWanted(G, dt) {
  const P = G.player;
  const cops = G.cars.filter((c) => c.police && !c.dead);
  // Nearest live cruiser to the player.
  let nearest = Infinity;
  for (const c of cops) nearest = Math.min(nearest, Math.hypot(c.x - P.x, c.y - P.y));
  const close = nearest < 500;
  // Heat bleeds: fast when the cops are far, a slow trickle while they are on you.
  const rate = close ? 0.05 : 0.25;
  if (G.wanted.heat > 0) {
    G.wanted.heat = Math.max(0, G.wanted.heat - rate * dt);
    G.wanted.stars = Math.round(G.wanted.heat);
  }
  // Spawn cruisers up to the wanted level, one every few seconds.
  const want = G.wanted.stars;
  if (want > 0 && cops.length < want) {
    G.policeSpawnT -= dt;
    if (G.policeSpawnT <= 0) {
      G.policeSpawnT = 3.5;
      spawnPolice(G);
    }
  }
  // Cruisers give up and leave when the heat is gone.
  if (G.wanted.heat <= 0) {
    for (const c of cops) {
      c.giveUp = (c.giveUp ?? 0) + dt;
      if (c.giveUp > 6) {
        c.dead = true; // drives off the map, removed below
        c.left = true;
      }
    }
    G.cars = G.cars.filter((c) => !c.left);
  }
}

function spawnPolice(G) {
  const P = G.player;
  const pt = randomRoadPoint(G.city, G.rng, P.x, P.y, 480);
  const car = createCar('police', pt.x, pt.y, 0, { traffic: false });
  car.pursuitT = 0;
  car.shotCd = 1.5;
  car.giveUp = 0;
  G.cars.push(car);
  if (G.audio) G.audio.siren();
}

// Police driving: steer at the player, ram, and shoot when close. A cruiser that
// cannot land a hit for a while loses the trail and peels off.
export function updatePolice(G, dt) {
  const P = G.player;
  for (const car of G.cars) {
    if (!car.police || car.dead) continue;
    const d = Math.hypot(P.x - car.x, P.y - car.y);
    const targetAngle = Math.atan2(P.y - car.y, P.x - car.x);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    car.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
    // Chase speed: a touch under the player's sports car, over a taxi.
    const want = d > 700 ? 250 : 235;
    car.speed += clamp(want - car.speed, -300 * dt, 240 * dt);
    // Ram: a nudge that slows the player down — never damage per frame (that
    // shreds a stationary car in under a second). The bump itself is the threat.
    if (d < 46 && P.car !== car) {
      if (P.car) P.car.speed *= 0.94;
    }
    // Shoot when in range; wild enough that a standoff is survivable.
    car.shotCd -= dt;
    if (d < 380 && car.shotCd <= 0) {
      car.shotCd = 1.25;
      G.fireBullet(car.x, car.y, targetAngle + (G.rng.next() - 0.5) * 0.5, 'police', 2);
    }
    // A cruiser gives up after 20 s of chasing in total — it peels off and the
    // heat can finally bleed away, so losing the cops is always possible.
    car.chaseT = (car.chaseT ?? 0) + dt;
    if (car.chaseT > 20) {
      car.giveUp = (car.giveUp ?? 0) + dt;
      if (car.giveUp > 4) {
        car.dead = true;
        car.left = true;
      }
    }
    // Move (reuse the shared mover via a light inline step to avoid a cycle:
    // police drive on roads and through blocks alike, colliding with buildings).
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const c = G.cityCollide(nx, ny, 15);
    car.x = c.x;
    car.y = c.y;
    if (Math.hypot(car.x - nx, car.y - ny) > 1) car.speed *= 0.5;
    car.sirenT += dt;
  }
  G.cars = G.cars.filter((c) => !c.left);
}
