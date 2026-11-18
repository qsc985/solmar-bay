// The player: Danny Reyes, on foot or behind the wheel. On foot he walks, runs and shoots;
// in a car the car is the body. Entering and leaving cars is the hinge of the whole game.
import { WALK_SPEED, RUN_SPEED, PLAYER_R, PLAYER_HEALTH } from './config.js';
import { clamp } from './random.js';
import { createGun } from './combat.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    health: PLAYER_HEALTH, cash: 0,
    car: null, // the car being driven, or null on foot
    gun: createGun(),
    invuln: 0, // brief grace after being hit
    moving: false,
  };
}

// On-foot movement: WASD/arrows, Shift to run. Collides with buildings.
export function updateOnFoot(P, input, dt, city) {
  const axis = input.axis();
  const len = Math.hypot(axis.x, axis.y) || 1;
  const speed = input.run() ? RUN_SPEED : WALK_SPEED;
  P.moving = axis.x !== 0 || axis.y !== 0;
  if (P.moving) {
    P.angle = Math.atan2(axis.y / len, axis.x / len);
    P.x += (axis.x / len) * speed * dt;
    P.y += (axis.y / len) * speed * dt;
    const c = city.collideCircle(P.x, P.y, PLAYER_R);
    P.x = c.x; P.y = c.y;
  }
  P.speed = P.moving ? speed : 0;
  P.invuln = Math.max(0, P.invuln - dt);
}

// Nearest car the player could enter (within reach, not wrecked).
export function nearestEnterableCar(P, cars) {
  let best = null, bd = 46 * 46;
  for (const c of cars) {
    if (c.dead || c.health <= 0) continue;
    const d = (c.x - P.x) ** 2 + (c.y - P.y) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// Step out of the car beside it; the car rolls to a stop on its own.
export function exitCar(P, car) {
  const side = car.angle + Math.PI / 2;
  P.x = car.x + Math.cos(side) * 34;
  P.y = car.y + Math.sin(side) * 34;
  P.angle = car.angle;
  P.car = null;
  car.driver = null;
  car.speed *= 0.3;
}

// Hurt the player (police fire, crashes). Returns true when it kills.
export function hurtPlayer(P, dmg) {
  if (P.invuln > 0) return false;
  P.health = clamp(P.health - dmg, 0, PLAYER_HEALTH);
  P.invuln = 0.4;
  return P.health <= 0;
}
export function healPlayer(P, amount) { P.health = clamp(P.health + amount, 0, PLAYER_HEALTH); }
