// Shooting: the player's pistol, gang and police fire, bullets, and what they hit.
import { PISTOL_DAMAGE, PISTOL_RANGE, BULLET_SPEED, PISTOL_MAG, RELOAD_TIME } from './config.js';

export function createGun() {
  return { ammo: PISTOL_MAG, reloading: 0, cooldown: 0 };
}
export function createBullets() { return []; }

// Fire one bullet from (x,y) toward an angle. Returns the bullet or null (reloading/empty).
export function fireBullet(bullets, gun, x, y, angle, from, dmg = 12) {
  if (gun.reloading > 0 || gun.cooldown > 0 || gun.ammo <= 0) return null;
  gun.ammo -= 1; gun.cooldown = 0.16;
  bullets.push({ x, y, vx: Math.cos(angle) * BULLET_SPEED, vy: Math.sin(angle) * BULLET_SPEED, life: PISTOL_RANGE / BULLET_SPEED, from, dmg });
  return bullets[bullets.length - 1];
}
export function updateGun(gun, dt) {
  gun.cooldown = Math.max(0, gun.cooldown - dt);
  if (gun.reloading > 0) {
    gun.reloading -= dt;
    if (gun.reloading <= 0) gun.ammo = PISTOL_MAG;
  }
}
export function reloadGun(gun) { if (gun.ammo < PISTOL_MAG && gun.reloading <= 0) gun.reloading = RELOAD_TIME; }

// Move bullets; test hits against peds, cars and the player. onHit(kind, target, x, y, dmg).
// stats (optional) counts outcomes: {wall, expired} — the caller counts hits in onHit.
export function updateBullets(bullets, dt, city, peds, cars, player, onHit, stats) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0;
    if (b.life <= 0 && stats) stats.expired = (stats.expired ?? 0) + 1;
    if (!dead) {
      // Buildings stop bullets.
      for (const bd of city.buildings) {
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) {
          dead = true;
          if (stats) stats.wall = (stats.wall ?? 0) + 1;
          break;
        }
      }
    }
    if (!dead && b.from !== 'player') {
      // Enemy fire can hit the player.
      if (Math.hypot(b.x - player.x, b.y - player.y) < 14) { onHit('player', player, b.x, b.y, b.dmg ?? 12); dead = true; }
    }
    if (!dead && b.from === 'player') {
      for (const p of peds) {
        if (p.down) continue;
        if (Math.hypot(b.x - p.x, b.y - p.y) < 13) { onHit('ped', p, b.x, b.y); dead = true; break; }
      }
    }
    if (!dead && b.from === 'player') {
      for (const c of cars) {
        if (c.dead) continue;
        const dx = b.x - c.x, dy = b.y - c.y;
        const along = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
        const side = -dx * Math.sin(c.angle) + dy * Math.cos(c.angle);
        if (Math.abs(along) < c.len / 2 && Math.abs(side) < c.wid / 2) {
          onHit('car', c, b.x, b.y); dead = true; break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}
export { PISTOL_DAMAGE };
