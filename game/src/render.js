// Rendering: one 2D canvas, a camera that follows the player, and the HUD.
// The world is 2600x1900; the view is always 1280x720. The minimap mirrors
// the whole city in the corner. Nothing here mutates game state.
import { WORLD, PAL, CAR_TYPES, PISTOL_MAG } from './config.js';
import { AVENUES, STREETS, ROAD_W, ROAD_H } from './city.js';
import { currentMission } from './missions.js';
import { MISSION_DEFS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_WIN = 'win';

const VIEW_W = 1280;
const VIEW_H = 720;

// A 128x128 tile of asphalt texture, pre-rendered once and tiled for roads.
function makeRoadTile() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = PAL.road;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 46; i++) {
    g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 5, 2 + Math.random() * 5);
  }
  return c;
}

// A 128x128 tile of sidewalk, pre-rendered once and tiled under the city.
function makeSidewalkTile() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = PAL.sidewalk;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.08)';
  g.lineWidth = 2;
  g.strokeRect(0, 0, 64, 64);
  g.strokeRect(64, 64, 64, 64);
  g.strokeRect(64, 0, 64, 64);
  g.strokeRect(0, 64, 64, 64);
  return c;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const roadTile = makeRoadTile();
  const sidewalkTile = makeSidewalkTile();
  const cam = { x: 0, y: 0, shake: 0 };

  function resize() {
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
    canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
  }

  function drawWorld(G, screen) {
    const P = G.player;
    const targetX = Math.max(-40, Math.min(P.x - VIEW_W / 2, WORLD.w - VIEW_W + 40));
    const targetY = Math.max(-40, Math.min(P.y - VIEW_H / 2, WORLD.h - VIEW_H + 40));
    cam.x += (targetX - cam.x) * 0.12;
    cam.y += (targetY - cam.y) * 0.12;
    cam.shake = Math.max(0, cam.shake - 0.03);
    const sx = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 8 : 0;
    const sy = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 8 : 0;

    ctx.save();
    ctx.translate(-cam.x + sx, -cam.y + sy);
    drawGround(G);
    drawLotsAndPark(G);
    drawBuildings(G);
    drawTrees(G);
    drawMarker(G);
    drawCars(G);
    drawPeds(G);
    drawBullets(G);
    drawPlayer(G);
    drawParticles(G);
    ctx.restore();
    if (screen === SCREEN_PLAY) {
      drawHUD(G);
      drawMinimap(G);
    }
  }

  function drawGround(G) {
    ctx.fillStyle = PAL.ground;
    ctx.fillRect(-40, -40, WORLD.w + 80, WORLD.h + 80);
    // Sidewalk tiles across the whole map.
    const pat = ctx.createPattern(sidewalkTile, 'repeat');
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, WORLD.w, WORLD.beachY);
    // Roads.
    ctx.fillStyle = ctx.createPattern(roadTile, 'repeat');
    for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD.beachY);
    for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_H / 2, WORLD.w, ROAD_H);
    // Lane markings: dashed centre lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 22]);
    for (const ax of AVENUES) {
      ctx.beginPath();
      ctx.moveTo(ax, 0);
      ctx.lineTo(ax, WORLD.beachY);
      ctx.stroke();
    }
    for (const sy of STREETS) {
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(WORLD.w, sy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Beach and sea.
    ctx.fillStyle = PAL.beach;
    ctx.fillRect(0, WORLD.beachY, WORLD.w, WORLD.h - WORLD.beachY);
    ctx.fillStyle = PAL.sea;
    ctx.fillRect(0, WORLD.beachY + 46, WORLD.w, WORLD.h - WORLD.beachY - 46);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, WORLD.beachY + 46, WORLD.w, 3);
  }

  function drawLotsAndPark(G) {
    const park = G.city.park;
    ctx.fillStyle = PAL.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.strokeStyle = '#7cb342';
    ctx.lineWidth = 2;
    ctx.strokeRect(park.x, park.y, park.w, park.h);
    // Landmarks: bank, depot, docks, safehouse.
    ctx.fillStyle = '#b8a88a';
    ctx.fillRect(G.city.bank.x, G.city.bank.y, G.city.bank.w, G.city.bank.h);
    ctx.fillStyle = '#8d7b63';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BANK', G.city.bank.x + 45, G.city.bank.y + 34);
    ctx.fillStyle = '#9a8c7a';
    ctx.fillRect(G.city.depot.x, G.city.depot.y, G.city.depot.w, G.city.depot.h);
    ctx.fillStyle = '#6d5f4f';
    ctx.fillText('TAXI DEPOT', G.city.depot.x + 60, G.city.depot.y + 38);
    ctx.fillStyle = '#7d8a99';
    ctx.fillRect(G.city.docks.x, G.city.docks.y, G.city.docks.w, G.city.docks.h);
    ctx.fillStyle = '#4a5a68';
    ctx.fillText('DOCKS', G.city.docks.x + 90, G.city.docks.y + 64);
    ctx.fillStyle = '#a89a7e';
    ctx.fillRect(G.city.safehouse.x, G.city.safehouse.y, G.city.safehouse.w, G.city.safehouse.h);
    ctx.fillStyle = '#5d5342';
    ctx.fillText('SAFEHOUSE', G.city.safehouse.x + 45, G.city.safehouse.y + 34);
    ctx.textAlign = 'left';
    // Parked-car lots.
    for (const lot of G.city.lots) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(lot.x + 4, lot.y + 4, lot.w - 8, lot.h - 8);
    }
  }

  function drawBuildings(G) {
    for (const b of G.city.buildings) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      // Roof props: AC units, a pool, or a garden.
      if (b.roof === 'ac') {
        ctx.fillStyle = '#c9c9c9';
        ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, 14, 10);
        ctx.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.55, 14, 10);
      } else if (b.roof === 'pool') {
        ctx.fillStyle = '#4fc3f7';
        ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, b.w * 0.55, b.h * 0.45);
        ctx.strokeStyle = '#0288d1';
        ctx.strokeRect(b.x + b.w * 0.2, b.y + b.h * 0.25, b.w * 0.55, b.h * 0.45);
      } else if (b.roof === 'garden') {
        ctx.fillStyle = '#81c784';
        ctx.fillRect(b.x + b.w * 0.15, b.y + b.h * 0.2, b.w * 0.7, b.h * 0.55);
      }
    }
  }

  function drawTrees(G) {
    for (const t of G.city.trees) {
      ctx.fillStyle = '#2d6a2d';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      ctx.arc(t.x - 2, t.y - 2, t.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMarker(G) {
    const t = G.missionTarget;
    if (!t) return;
    const pulse = 1 + Math.sin(G.time * 4) * 0.12;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, t.r ?? 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,63,0.15)';
    ctx.beginPath();
    ctx.arc(0, 0, t.r ?? 46, 0, Math.PI * 2);
    ctx.fill();
    // Diamond above the ring.
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(0, -62);
    ctx.lineTo(10, -48);
    ctx.lineTo(0, -34);
    ctx.lineTo(-10, -48);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCars(G) {
    for (const car of G.cars) {
      if (car.dead) continue;
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      const t = CAR_TYPES[car.type];
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-car.len / 2 + 3, -car.wid / 2 + 3, car.len, car.wid);
      ctx.fillStyle = car.color;
      ctx.fillRect(-car.len / 2, -car.wid / 2, car.len, car.wid);
      ctx.fillStyle = '#222';
      ctx.fillRect(-car.len / 2 + 4, -car.wid / 2 - 3, 10, 4);
      ctx.fillRect(-car.len / 2 + 4, car.wid / 2 - 1, 10, 4);
      ctx.fillRect(car.len / 2 - 14, -car.wid / 2 - 3, 10, 4);
      ctx.fillRect(car.len / 2 - 14, car.wid / 2 - 1, 10, 4);
      ctx.fillStyle = '#aee2ff';
      ctx.fillRect(-car.len / 2 + 12, -car.wid / 2 + 4, 12, car.wid - 8);
      ctx.fillStyle = '#b0bec5';
      ctx.fillRect(car.len / 2 - 10, -car.wid / 2 + 4, 8, car.wid - 8);
      if (car.type === 'taxi') {
        ctx.fillStyle = '#222';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TAXI', 0, 3);
        ctx.textAlign = 'left';
      }
      if (car.type === 'police') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-car.len / 2 + 20, -car.wid / 2, 14, car.wid);
        ctx.fillStyle = '#111';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PD', -car.len / 2 + 27, 3);
        ctx.textAlign = 'left';
      }
      // Damage smoke.
      if (car.health < 40) {
        ctx.fillStyle = `rgba(60,60,60,${0.4 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(-car.len / 2 + 6, 0, 6 + Math.random() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Police light bar: flashing red/blue, offset by the siren state.
      if (car.type === 'police') {
        const on = Math.floor(G.time * 6 + car.id) % 2 === 0;
        ctx.fillStyle = on ? '#ff1744' : '#2979ff';
        ctx.fillRect(-4, -car.wid / 2 - 3, 8, 6);
        ctx.fillStyle = on ? '#2979ff' : '#ff1744';
        ctx.fillRect(-4, car.wid / 2 - 3, 8, 6);
      }
      ctx.restore();
      // Health bar over a damaged car.
      if (car.health < 100) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(car.x - 20, car.y - car.wid / 2 - 12, 40, 5);
        ctx.fillStyle = car.health > 40 ? '#4caf50' : '#f44336';
        ctx.fillRect(car.x - 20, car.y - car.wid / 2 - 12, 40 * Math.max(0, car.health) / 100, 5);
      }
    }
  }

  function drawPeds(G) {
    for (const p of G.peds) {
      if (p.down) {
        // Lying on the ground, unmoving.
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle + Math.PI / 2);
        ctx.fillStyle = p.shirt;
        ctx.fillRect(-8, -5, 16, 10);
        ctx.fillStyle = p.skin;
        ctx.beginPath();
        ctx.arc(11, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }
      // Body: a circle with a walking bob, plus a facing tick.
      const bob = p.speed > 0 ? Math.sin(G.time * 10 + p.id) * 1.5 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 8, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.shirt;
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob * 0.3, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.skin;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4 + bob * 0.3, 5.5, 0, Math.PI * 2);
      ctx.fill();
      if (p.gang) {
        ctx.fillStyle = '#ff5d8f';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VIPER', p.x, p.y - 16);
        ctx.textAlign = 'left';
      }
    }
  }

  function drawBullets(G) {
    ctx.fillStyle = '#ffe66d';
    for (const b of G.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer(G) {
    const P = G.player;
    if (P.car) return; // the car is the player while driving
    const bob = P.moving ? Math.sin(G.time * 12) * 1.5 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(P.x, P.y + 9, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.arc(P.x, P.y + bob * 0.3, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath();
    ctx.arc(P.x + Math.cos(P.angle) * 5, P.y + Math.sin(P.angle) * 5 + bob * 0.3, 6, 0, Math.PI * 2);
    ctx.fill();
    // The pistol, pointed where the mouse aims.
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(P.x + Math.cos(P.angle) * 8, P.y + Math.sin(P.angle) * 8);
    ctx.lineTo(P.x + Math.cos(P.angle) * 18, P.y + Math.sin(P.angle) * 18);
    ctx.stroke();
    // Brief invulnerability flash after being hit.
    if (P.invuln > 0 && Math.floor(G.time * 10) % 2 === 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(P.x, P.y, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawParticles(G) {
    for (const p of G.particles.list) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    for (const f of G.particles.floats) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawHUD(G) {
    const P = G.player;
    const M = G.missions;
    ctx.save();
    // Wanted stars, top right.
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < G.wanted.stars ? '#ffd23f' : 'rgba(0,0,0,0.45)';
      ctx.fillText('★', 1260 - i * 30, 40);
    }
    ctx.textAlign = 'left';
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(16, 16, 220, 22);
    ctx.fillStyle = P.health > 40 ? '#4caf50' : '#f44336';
    ctx.fillRect(18, 18, 216 * Math.max(0, P.health) / 100, 18);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`HEALTH ${Math.ceil(P.health)}`, 24, 32);
    // Cash.
    ctx.fillStyle = '#4caf50';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`$${P.cash}`, 16, 66);
    // Ammo / reload, or the driven car's health.
    if (P.car) {
      const car = P.car;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(16, 76, 220, 22);
      ctx.fillStyle = car.health > 40 ? '#4caf50' : '#f44336';
      ctx.fillRect(18, 78, 216 * Math.max(0, car.health) / 100, 18);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`CAR ${Math.ceil(car.health)}`, 24, 92);
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      const ammo = P.gun.reloading > 0 ? 'RELOADING…' : `AMMO ${P.gun.ammo} / ${PISTOL_MAG}`;
      ctx.fillText(ammo, 16, 92);
    }
    // Current objective, top centre.
    const m = currentMission(M);
    if (m) {
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const label = `${m.name} — ${m.objective}`;
      const w = ctx.measureText(label).width + 24;
      ctx.fillRect(640 - w / 2, 8, w, 26);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(label, 640, 26);
      ctx.textAlign = 'left';
    }
    // Dialogue line above the objective.
    if (M.dialogueT > 0 && M.dialogue) {
      ctx.font = '15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const w = ctx.measureText(M.dialogue).width + 20;
      ctx.fillRect(640 - w / 2, 42, w, 24);
      ctx.fillStyle = '#fff';
      ctx.fillText(M.dialogue, 640, 59);
      ctx.textAlign = 'left';
    }
    // Mission banner, centre screen.
    if (M.bannerT > 0 && M.banner) {
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const w = ctx.measureText(M.banner).width + 40;
      ctx.fillRect(640 - w / 2, 300, w, 48);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(M.banner, 640, 333);
      ctx.textAlign = 'left';
    }
    // Context hint, bottom centre.
    let hint = '';
    if (G.pickup && !P.car) hint = 'Press E — pick up';
    else if (G.nearCar && !P.car) hint = 'Press E — enter car';
    else if (P.car) hint = 'E — exit car';
    if (hint) {
      ctx.font = '15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const w = ctx.measureText(hint).width + 20;
      ctx.fillRect(640 - w / 2, 676, w, 26);
      ctx.fillStyle = '#fff';
      ctx.fillText(hint, 640, 694);
      ctx.textAlign = 'left';
    }
    // Mute state.
    if (G.muted) {
      ctx.fillStyle = '#fff';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('MUTED (M)', 1260, 700);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  function drawMinimap(G) {
    const scale = 200 / WORLD.w;
    const mw = 200;
    const mh = WORLD.h * scale;
    const mx = 1280 - mw - 12;
    const my = 720 - mh - 12;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.fillStyle = PAL.ground;
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = PAL.road;
    for (const ax of AVENUES) ctx.fillRect(mx + ax * scale - 1, my, 2, mh);
    for (const sy of STREETS) ctx.fillRect(mx, my + sy * scale - 1, mw, 2);
    ctx.fillStyle = PAL.park;
    ctx.fillRect(mx + G.city.park.x * scale, my + G.city.park.y * scale, G.city.park.w * scale, G.city.park.h * scale);
    ctx.fillStyle = PAL.sea;
    ctx.fillRect(mx, my + WORLD.beachY * scale + 4, mw, mh - WORLD.beachY * scale - 4);
    // Mission target.
    const t = G.missionTarget;
    if (t) {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(mx + t.x * scale, my + t.y * scale, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player.
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mx + G.player.x * scale, my + G.player.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx + G.player.x * scale, my + G.player.y * scale, 3.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawTitle(G) {
    ctx.fillStyle = '#0b1e33';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // A painted sunset strip as a backdrop.
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#1a2f4a');
    grad.addColorStop(0.55, '#ff8c42');
    grad.addColorStop(1, '#0b1e33');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(900, 220, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b1e33';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SOLMAR BAY', 640, 260);
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.fillText('A tiny open-world crime story — five jobs, one debt, no mercy.', 640, 310);
    ctx.font = '18px sans-serif';
    ctx.fillText('WASD move · Mouse aim · Click shoot · E enter car / pick up · R reload · Shift run · Esc pause', 640, 360);
    ctx.fillText('Steal cars, lose the cops, and pay off Lena Cruz.', 640, 392);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = Math.floor(G.time * 2) % 2 === 0 ? '#ffd23f' : '#fff';
    ctx.fillText('Press ENTER to start', 640, 470);
    if (G.hasSave) {
      ctx.fillStyle = '#fff';
      ctx.font = '18px sans-serif';
      ctx.fillText('Press C to continue your saved game', 640, 510);
    }
    ctx.textAlign = 'left';
  }

  function drawPaused(G) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', 640, 300);
    ctx.font = '20px sans-serif';
    ctx.fillText('Esc — resume · S — save & quit to title · R — restart mission', 640, 350);
    ctx.textAlign = 'left';
  }

  function drawWasted(G) {
    ctx.fillStyle = 'rgba(20,0,0,0.8)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ff5d5d';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WASTED', 640, 330);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('Press ENTER to retry the mission · T for title', 640, 380);
    ctx.textAlign = 'left';
  }

  function drawWin(G) {
    ctx.fillStyle = 'rgba(0,30,10,0.85)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DEBT PAID', 640, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '22px sans-serif';
    ctx.fillText(`Danny walked away with $${G.player.cash}. Solmar Bay is his now.`, 640, 350);
    ctx.font = '20px sans-serif';
    ctx.fillText('Press ENTER for free roam — taxi fares pay the rent · T for title', 640, 400);
    ctx.textAlign = 'left';
  }

  function draw(G, screen) {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (screen === SCREEN_TITLE) {
      drawTitle(G);
      return;
    }
    drawWorld(G, screen);
    if (screen === SCREEN_PAUSED) drawPaused(G);
    else if (screen === SCREEN_WASTED) drawWasted(G);
    else if (screen === SCREEN_WIN) drawWin(G);
  }

  return { resize, cam, draw };
}
