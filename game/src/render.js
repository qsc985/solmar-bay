// All canvas drawing: the city, cars, people, effects, HUD, minimap and menus.
// The camera is centred on the player; the world is drawn in world coordinates.

import { WORLD_W, WORLD_H, PAL, MISSION_NAMES } from './config.js';
import { missionObjective, missionName } from './missions.js';

export function createRenderer(canvas) {
  return {
    canvas,
    ctx: canvas.getContext('2d'),
    cam: { x: 0, y: 0 },
    viewW: canvas.width,
    viewH: canvas.height,
  };
}

export function updateCamera(G) {
  const r = G.renderer;
  const vw = r.viewW;
  const vh = r.viewH;
  r.cam.x = Math.max(0, Math.min(WORLD_W - vw, G.player.x - vw / 2));
  r.cam.y = Math.max(0, Math.min(WORLD_H - vh, G.player.y - vh / 2));
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function render(G) {
  const r = G.renderer;
  const ctx = r.ctx;
  const vw = r.viewW;
  const vh = r.viewH;
  ctx.clearRect(0, 0, vw, vh);
  ctx.save();
  ctx.translate(-r.cam.x, -r.cam.y);
  drawGround(G, ctx);
  drawRoads(G, ctx);
  drawLots(G, ctx);
  drawBuildings(G, ctx);
  drawTrees(G, ctx);
  drawTarget(G, ctx);
  drawCars(G, ctx);
  drawPeds(G, ctx);
  drawPlayer(G, ctx);
  drawBullets(G, ctx);
  drawParticles(G, ctx);
  ctx.restore();
  if (G.screen === 'play') {
    drawHUD(G, ctx);
    drawMinimap(G, ctx);
  } else if (G.screen === 'title') {
    drawTitle(G, ctx);
  } else if (G.screen === 'win') {
    drawWin(G, ctx);
  } else if (G.screen === 'dead') {
    drawDead(G, ctx);
  }
}

function drawGround(G, ctx) {
  const c = G.city;
  // Grass base.
  ctx.fillStyle = PAL.grass;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Mown patches for texture.
  ctx.fillStyle = PAL.grassDark;
  for (let i = 0; i < 40; i++) {
    const x = ((i * 613) % 2300) + 40;
    const y = ((i * 277) % 1550) + 40;
    ctx.fillRect(x, y, 90, 46);
  }
  // Beach, then the sea with slow waves.
  ctx.fillStyle = PAL.beach;
  ctx.fillRect(0, c.beachY, WORLD_W, c.seaY - c.beachY);
  ctx.fillStyle = PAL.sea;
  ctx.fillRect(0, c.seaY, WORLD_W, WORLD_H - c.seaY);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  const t = G.time;
  for (let k = 0; k < 5; k++) {
    const wy = c.seaY + 18 + k * 22;
    ctx.beginPath();
    for (let x = 0; x <= WORLD_W; x += 60) {
      const y = wy + Math.sin(x / 180 + t * 1.4 + k) * 4;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawRoads(G, ctx) {
  const c = G.city;
  ctx.fillStyle = PAL.road;
  for (const y of c.roadsH) ctx.fillRect(0, y - 32, WORLD_W, 64);
  for (const x of c.roadsV) ctx.fillRect(x - 32, 0, 64, WORLD_H);
  // Centre dashes.
  ctx.strokeStyle = PAL.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const y of c.roadsH) {
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_W, y);
  }
  for (const x of c.roadsV) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD_H);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Sidewalk edges.
  ctx.strokeStyle = PAL.sidewalk;
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (const y of c.roadsH) {
    ctx.moveTo(0, y - 34);
    ctx.lineTo(WORLD_W, y - 34);
    ctx.moveTo(0, y + 34);
    ctx.lineTo(WORLD_W, y + 34);
  }
  ctx.stroke();
}

function drawLots(G, ctx) {
  for (const lot of G.city.lots) {
    ctx.fillStyle = '#4a4a52';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < lot.bays; i++) {
      const bx = lot.x + 8 + (i * (lot.w - 16)) / lot.bays;
      ctx.strokeRect(bx, lot.y + 8, (lot.w - 16) / lot.bays - 4, lot.h - 16);
    }
  }
}

function drawBuildings(G, ctx) {
  for (const b of G.city.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Roof inset.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    // Windows.
    ctx.fillStyle = 'rgba(220,235,255,0.75)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 10 + i * 26, b.y + 10 + j * 26, 12, 9);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  // The bank gets a sign; the safehouse gets a green door.
  ctx.fillStyle = '#1c2733';
  ctx.fillRect(1014 - 70, 560 - 70, 140, 44);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR BANK', 1014, 560 - 42);
  ctx.fillStyle = '#2f9e44';
  ctx.fillRect(300 - 16, 300 - 16, 32, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('SAFE', 300, 304);
}

function drawTrees(G, ctx) {
  for (const t of G.city.trees) {
    ctx.fillStyle = PAL.treeDark;
    ctx.beginPath();
    ctx.arc(t.x, t.y + 2, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.tree;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTarget(G, ctx) {
  const t = G.missionTarget;
  if (!t || G.screen !== 'play') return;
  const pulse = 1 + Math.sin(G.time * 4) * 0.15;
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(t.x, t.y, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(t.x, t.y, 5, 0, Math.PI * 2);
  ctx.fill();
  // The package pickup gets its own marker.
  if (G.pickup) {
    ctx.fillStyle = '#ff9f1c';
    ctx.fillRect(G.pickup.x - 10, G.pickup.y - 8, 20, 16);
    ctx.fillStyle = '#7a4a00';
    ctx.fillRect(G.pickup.x - 10, G.pickup.y - 8, 20, 5);
  }
  // Edge arrow: when the target is off-screen, point at it from the frame edge.
  const r = G.renderer;
  const sx = t.x - r.cam.x;
  const sy = t.y - r.cam.y;
  if (sx < 0 || sx > r.viewW || sy < 0 || sy > r.viewH) {
    const cx = Math.max(30, Math.min(r.viewW - 30, sx));
    const cy = Math.max(30, Math.min(r.viewH - 30, sy));
    const a = Math.atan2(t.y - G.player.y, t.x - G.player.x);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawCarShape(ctx, car) {
  const def = { len: 46, wid: 22 };
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(ctx, -24 + 3, -11 + 4, 48, 22, 8);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  rr(ctx, -24, -11, 48, 22, 8);
  ctx.fill();
  // Roof + windshield.
  ctx.fillStyle = 'rgba(20,30,40,0.85)';
  rr(ctx, -6, -8, 16, 16, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.8)';
  ctx.fillRect(12, -8, 5, 16);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(22, -9, 3, 5);
  ctx.fillRect(22, 4, 3, 5);
  // Taxi checker strip.
  if (car.type === 'taxi') {
    ctx.fillStyle = '#1c2733';
    for (let i = 0; i < 6; i++) ctx.fillRect(-18 + i * 6, -11, 3, 4);
    for (let i = 0; i < 6; i++) ctx.fillRect(-18 + i * 6, 7, 3, 4);
  }
  // Police: white doors + light bar.
  if (car.type === 'police') {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-8, -11, 14, 22);
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-4, -13, 8, 5);
    ctx.fillStyle = flash ? '#2e6bff' : '#ff2e2e';
    ctx.fillRect(-4, 8, 8, 5);
  }
  // Damage smoke.
  if (car.health < 45) {
    ctx.fillStyle = 'rgba(80,80,80,0.6)';
    ctx.beginPath();
    ctx.arc(-14, 0, 6 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Wrecked: dark overlay.
  if (car.dead) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    rr(ctx, -24, -11, 48, 22, 8);
    ctx.fill();
    ctx.restore();
  }
}

function drawCars(G, ctx) {
  for (const car of G.cars) drawCarShape(ctx, car);
}

function drawPeds(G, ctx) {
  for (const p of G.peds) {
    if (p.down) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 12, 6, p.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(p.x + 2, p.y + 3, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, 5, 0, Math.PI * 2);
    ctx.fill();
    if (p.gang) {
      ctx.strokeStyle = '#ff5a5a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawPlayer(G, ctx) {
  const P = G.player;
  if (P.car) return; // the car is drawn instead
  if (P.dead) return;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(P.x + 2, P.y + 3, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f766e';
  ctx.beginPath();
  ctx.arc(P.x, P.y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath();
  ctx.arc(P.x + Math.cos(P.angle) * 5, P.y + Math.sin(P.angle) * 5, 6, 0, Math.PI * 2);
  ctx.fill();
  // Gun direction tick.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(P.x + Math.cos(P.angle) * 10, P.y + Math.sin(P.angle) * 10);
  ctx.lineTo(P.x + Math.cos(P.angle) * 20, P.y + Math.sin(P.angle) * 20);
  ctx.stroke();
  // Brief hit flash.
  if (P.invuln > 0.15) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(P.x, P.y, 15, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBullets(G, ctx) {
  ctx.fillStyle = '#ffe66d';
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(G, ctx) {
  for (const p of G.particles.list) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const f of G.particles.floats) {
    ctx.globalAlpha = Math.max(0, f.life / 1.4);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawHUD(G, ctx) {
  const vw = G.renderer.viewW;
  const P = G.player;
  // Top-left panel.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  rr(ctx, 12, 12, 300, 96, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${P.cash}`, 26, 44);
  // Health bar.
  ctx.fillStyle = '#333';
  ctx.fillRect(26, 54, 180, 12);
  ctx.fillStyle = P.health > 40 ? '#37b24d' : '#e03131';
  ctx.fillRect(26, 54, 180 * Math.max(0, P.health / 100), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(`HP ${Math.ceil(P.health)}`, 212, 65);
  // Wanted stars.
  ctx.font = '22px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < G.wanted.stars ? '★' : '☆';
  ctx.fillStyle = G.wanted.stars > 0 ? '#ff5a5a' : '#888';
  ctx.fillText(stars, 26, 96);
  // Mission line.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  const obj = missionObjective(G);
  ctx.font = '15px sans-serif';
  const w = ctx.measureText(obj).width + 28;
  rr(ctx, 12, 118, Math.min(w, vw - 240), 30, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(obj, 26, 138);
  // Context hint.
  const hint = contextHint(G);
  if (hint) {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    const hw = ctx.measureText(hint).width + 28;
    rr(ctx, vw / 2 - hw / 2, G.renderer.viewH - 44, hw, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.textAlign = 'center';
    ctx.fillText(hint, vw / 2, G.renderer.viewH - 24);
    ctx.textAlign = 'left';
  }
  // Ammo + reload state.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  rr(ctx, vw - 190, G.renderer.viewH - 44, 178, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  const gun = P.gun;
  ctx.fillText(gun.reloading > 0 ? 'RELOADING…' : `AMMO ${gun.ammo} / ${gun.maxAmmo}  [R]`, vw - 101, G.renderer.viewH - 24);
  ctx.textAlign = 'left';
  if (G.audio && G.audio.muted) {
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('MUTED [M]', vw - 190, G.renderer.viewH - 52);
  }
}

function contextHint(G) {
  const P = G.player;
  const m = G.missions;
  if (!P.car) {
    if (m.index === 1 && m.stage === 'pickup' && G.pickup && Math.hypot(P.x - G.pickup.x, P.y - G.pickup.y) < 70) return 'Press E — pick up the package';
    if (m.index === 4 && m.stage === 'grab' && Math.hypot(P.x - 1014, P.y - 640) < 70) return 'Press E — grab the bank cash';
    const car = G.nearestCar;
    if (car) return car.type === 'taxi' ? 'Press E — get in the taxi' : 'Press E — steal this car';
  } else {
    return 'E — get out   •   Mouse — shoot (drive-by)';
  }
  return null;
}

function drawMinimap(G, ctx) {
  const vw = G.renderer.viewW;
  const mw = 200;
  const mh = 150;
  const x0 = vw - mw - 14;
  const y0 = 14;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  rr(ctx, x0 - 4, y0 - 4, mw + 8, mh + 8, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#5d8a48';
  ctx.fillRect(x0, y0, mw, mh);
  ctx.fillStyle = '#2e7fb8';
  ctx.fillRect(x0, y0 + G.city.seaY * sy, mw, mh - G.city.seaY * sy);
  ctx.strokeStyle = '#3d3d46';
  ctx.lineWidth = 3;
  for (const ry of G.city.roadsH) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * sy);
    ctx.lineTo(x0 + mw, y0 + ry * sy);
    ctx.stroke();
  }
  for (const rx of G.city.roadsV) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * sx, y0);
    ctx.lineTo(x0 + rx * sx, y0 + mh);
    ctx.stroke();
  }
  ctx.fillStyle = '#c96f4a';
  for (const b of G.city.buildings) ctx.fillRect(x0 + b.x * sx, y0 + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  // Objective marker.
  if (G.missionTarget) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(x0 + G.missionTarget.x * sx, y0 + G.missionTarget.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#4d7cfe';
  for (const c of G.cars) {
    if (c.police && !c.dead) {
      ctx.beginPath();
      ctx.arc(x0 + c.x * sx, y0 + c.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Player.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + G.player.x * sx, y0 + G.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTitle(G, ctx) {
  const vw = G.renderer.viewW;
  const vh = G.renderer.viewH;
  ctx.fillStyle = 'rgba(8,12,24,0.55)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('SOLMAR BAY', vw / 2, vh / 2 - 110);
  ctx.fillStyle = '#fff';
  ctx.font = '22px sans-serif';
  ctx.fillText('An open-world crime story — five jobs, one big score', vw / 2, vh / 2 - 66);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#cfe3ff';
  ctx.fillText('WASD drive & walk  •  Shift run  •  E enter / steal cars  •  Mouse aim, click shoot  •  R reload  •  M mute', vw / 2, vh / 2 - 20);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(Math.floor(G.time * 1.6) % 2 === 0 ? 'Press ENTER to play' : 'Press ENTER to play', vw / 2, vh / 2 + 40);
  ctx.fillStyle = '#9fb3c8';
  ctx.font = '15px sans-serif';
  ctx.fillText('Danny Reyes came to Solmar Bay with nothing. The city has other plans.', vw / 2, vh / 2 + 80);
  ctx.textAlign = 'left';
}

function drawWin(G, ctx) {
  const vw = G.renderer.viewW;
  const vh = G.renderer.viewH;
  ctx.fillStyle = 'rgba(8,20,10,0.6)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('THE BIG SCORE!', vw / 2, vh / 2 - 60);
  ctx.fillStyle = '#fff';
  ctx.font = '26px sans-serif';
  ctx.fillText(`Danny walks away with $${G.player.cash}`, vw / 2, vh / 2 - 10);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#cfe3ff';
  ctx.fillText('All five jobs done. The Bay is yours now.', vw / 2, vh / 2 + 30);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Press ENTER — free roam', vw / 2, vh / 2 + 80);
  ctx.textAlign = 'left';
}

function drawDead(G, ctx) {
  const vw = G.renderer.viewW;
  const vh = G.renderer.viewH;
  ctx.fillStyle = 'rgba(20,4,4,0.6)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a5a';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('WASTED', vw / 2, vh / 2 - 40);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('Solmar Bay is not done with you yet.', vw / 2, vh / 2 + 10);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Press ENTER to get back up (-$50)', vw / 2, vh / 2 + 60);
  ctx.textAlign = 'left';
}

export { MISSION_NAMES, missionName };
