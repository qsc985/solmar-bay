// Combat: the player's pistol, police and gang fire, bullets and hit tests.
// A bullet belongs to an owner ('player', 'police', 'gang') and only hurts the
// other side. Bullets stop on buildings.

import { hitsBuilding } from './city.js';
import { damagePed } from './peds.js';
import { damageCar } from './cars.js';

export function createGun() {
  return { ammo: 12, maxAmmo: 12, cooldown: 0, reloading: 0 };
}

export function createBullet(x, y, angle, owner, damage) {
  const speed = 680;
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0.85,
    owner,
    damage,
  };
}

export function updateBullets(G, dt) {
  const P = G.player;
  for (const b of G.bullets) {
    b.life -= dt;
    // Step in small increments so fast bullets cannot tunnel through a ped.
    const steps = 3;
    for (let s = 0; s < steps && b.life > 0; s++) {
      b.x += (b.vx * dt) / steps;
      b.y += (b.vy * dt) / steps;
      if (hitsBuilding(G.city, b.x, b.y, 2)) { b.life = 0; break; }
      if (b.x < 0 || b.x > G.city.worldW || b.y < 0 || b.y > G.city.worldH) { b.life = 0; break; }
      if (b.owner === 'player') {
        // Hit a gang member or a walker.
        for (const ped of G.peds) {
          if (ped.down) continue;
          if ((ped.x - b.x) ** 2 + (ped.y - b.y) ** 2 < 17 * 17) {
            damagePed(G, ped, b.damage);
            G.addParticles(b.x, b.y, 'spark', 4);
            if (G.wanted) G.addHeatSilent(0.15);
            b.life = 0;
            break;
          }
        }
        if (b.life <= 0) break;
        // Hit a car (not the one the player drives).
        for (const car of G.cars) {
          if (car.dead || car === P.car) continue;
          if ((car.x - b.x) ** 2 + (car.y - b.y) ** 2 < 24 * 24) {
            damageCar(G, car, b.damage);
            G.addParticles(b.x, b.y, 'spark', 4);
            b.life = 0;
            break;
          }
        }
      } else {
        // Enemy fire: hurts the player, or his car first when he is driving.
        const px = P.x;
        const py = P.y;
        if ((px - b.x) ** 2 + (py - b.y) ** 2 < 16 * 16) {
          if (P.car) damageCar(G, P.car, b.damage, null);
          else if (G.hurtPlayer) G.hurtPlayer(b.damage);
          G.addParticles(b.x, b.y, 'spark', 3);
          b.life = 0;
          break;
        }
        // Enemy bullets can also wreck other cars (a cop shooting a Viper counts).
        for (const car of G.cars) {
          if (car.dead || car === P.car) continue;
          if ((car.x - b.x) ** 2 + (car.y - b.y) ** 2 < 24 * 24) {
            damageCar(G, car, b.damage, null);
            b.life = 0;
            break;
          }
        }
        if (b.life <= 0) break;
        for (const ped of G.peds) {
          if (ped.down) continue;
          // Gang and police crossfire can drop a Viper: it still counts.
          if (b.owner === 'police' && ped.gang && (ped.x - b.x) ** 2 + (ped.y - b.y) ** 2 < 17 * 17) {
            damagePed(G, ped, b.damage);
            G.addParticles(b.x, b.y, 'spark', 4);
            b.life = 0;
            break;
          }
        }
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
}

// The player's pistol: mouse aim, 12 rounds, R to reload.
export function playerShoot(G) {
  const P = G.player;
  const gun = P.gun;
  if (gun.reloading > 0 || gun.cooldown > 0) return false;
  if (gun.ammo <= 0) {
    gun.reloading = 1.1;
    return false;
  }
  gun.ammo -= 1;
  gun.cooldown = 0.24;
  const mx = G.renderer.cam.x + G.input.mouse.x;
  const my = G.renderer.cam.y + G.input.mouse.y;
  const angle = Math.atan2(my - P.y, mx - P.x);
  const ox = P.x + Math.cos(angle) * 20;
  const oy = P.y + Math.sin(angle) * 20;
  G.bullets.push(createBullet(ox, oy, angle, 'player', 34));
  G.shotsFiredAt = 1.5;
  G.addParticles(ox, oy, 'muzzle', 3);
  if (G.audio) G.audio.shoot();
  if (G.wanted) G.addHeatSilent(0.12);
  return true;
}

export function updateGun(G, dt) {
  const gun = G.player.gun;
  gun.cooldown = Math.max(0, gun.cooldown - dt);
  if (gun.reloading > 0) {
    gun.reloading -= dt;
    if (gun.reloading <= 0) {
      gun.ammo = gun.maxAmmo;
      gun.reloading = 0;
    }
  }
}
