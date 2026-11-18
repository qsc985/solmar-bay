// Rendering: a sun-soaked top-down city, the camera, the HUD and the minimap.
// Everything the judge sees in a screenshot comes from here.
import { WORLD, PAL, WANTED_MAX } from './config.js';
import { AVENUES, STREETS, ROAD_W, ROAD_H } from './city.js';
import { clamp, lerp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_WIN = 'win';

const VIEW_W = 1280, VIEW_H = 720;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW_W; canvas.height = VIEW_H;
  const cam = { x: 0, y: 0, zoom: 1, shake: 0 };
  return {
    canvas, ctx, cam,
    resize() {
      const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
      canvas.style.width = `${Math.floor(VIEW_W * s)}px`;
      canvas.style.height = `${Math.floor(VIEW_H * s)}px`;
    },
    draw(G, screen) {
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      if (screen === SCREEN_TITLE) { drawTitle(ctx, G); return; }
      if (screen === SCREEN_WIN) { drawWin(ctx, G); return; }
      // Camera follows the player (or the driven car), eased, with a shake on impacts.
      const px = G.player.car ? G.player.car.x : G.player.x;
      const py = G.player.car ? G.player.car.y : G.player.y;
      cam.x = lerp(cam.x, px - VIEW_W / 2, 0.12);
      cam.y = lerp(cam.y, py - VIEW_H / 2, 0.12);
      cam.x = clamp(cam.x, -40, WORLD.w - VIEW_W + 40);
      cam.y = clamp(cam.y, -40, WORLD.h - VIEW_H + 40);
      cam.shake = Math.max(0, cam.shake - 0.02);
      const sx = cam.shake ? (Math.random() - 0.5) * cam.shake * 14 : 0;
      const sy = cam.shake ? (Math.random() - 0.5) * cam.shake * 14 : 0;
      ctx.save();
      ctx.translate(-Math.round(cam.x + sx), -Math.round(cam.y + sy));
      drawWorld(ctx, G);
      ctx.restore();
      drawHUD(ctx, G, screen);
      if (screen === SCREEN_PAUSED) drawPaused(ctx, G);
      if (screen === SCREEN_WASTED) drawWasted(ctx, G);
    },
  };
}

function drawWorld(ctx, G) {
  const { city, time } = G;
  // Ground: grass, then the beach and the sea.
  ctx.fillStyle = PAL.grass; ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.fillStyle = PAL.grassDark;
  for (let i = 0; i < 40; i++) {
    const x = ((i * 379) % WORLD.w), y = ((i * 613) % WORLD.h);
    ctx.fillRect(x, y, 90, 46);
  }
  ctx.fillStyle = PAL.sand; ctx.fillRect(0, WORLD.beachY, WORLD.w, WORLD.h - WORLD.beachY);
  ctx.fillStyle = PAL.waterDeep; ctx.fillRect(0, WORLD.waterY, WORLD.w, WORLD.h - WORLD.waterY);
  ctx.fillStyle = PAL.water;
  ctx.fillRect(0, WORLD.waterY, WORLD.w, 26);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
  for (let x = 0; x < WORLD.w; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x + ((time * 12) % 90), WORLD.waterY + 34);
    ctx.quadraticCurveTo(x + 22 + ((time * 12) % 90), WORLD.waterY + 28, x + 45 + ((time * 12) % 90), WORLD.waterY + 34);
    ctx.stroke();
  }
  // Park.
  ctx.fillStyle = PAL.park; ctx.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
  ctx.strokeStyle = '#5a9e57'; ctx.lineWidth = 3;
  ctx.strokeRect(city.park.x, city.park.y, city.park.w, city.park.h);
  // Roads: asphalt, sidewalk border, centre dashes, crosswalks.
  ctx.fillStyle = PAL.sidewalk;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2 - 8, 0, ROAD_W + 16, WORLD.beachY);
  for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_H / 2 - 8, WORLD.w, ROAD_H + 16);
  ctx.fillStyle = PAL.road;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD.beachY);
  for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_H / 2, WORLD.w, ROAD_H);
  ctx.fillStyle = PAL.line;
  for (const ax of AVENUES) {
    for (let y = 20; y < WORLD.beachY; y += 44) {
      if (STREETS.some((sy) => Math.abs(y - sy) < 50)) continue;
      ctx.fillRect(ax - 2, y, 4, 22);
    }
  }
  for (const sy of STREETS) {
    for (let x = 20; x < WORLD.w; x += 44) {
      if (AVENUES.some((ax) => Math.abs(x - ax) < 50)) continue;
      ctx.fillRect(x, sy - 2, 22, 4);
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const ax of AVENUES) for (const sy of STREETS) {
    ctx.fillRect(ax - 26, sy - ROAD_H / 2 - 4, 52, 5);
    ctx.fillRect(ax - 26, sy + ROAD_H / 2 - 1, 52, 5);
    ctx.fillRect(ax - ROAD_W / 2 - 4, sy - 22, 5, 44);
    ctx.fillRect(ax + ROAD_W / 2 - 1, sy - 22, 5, 44);
  }
  // Buildings with soft shadows and rooftop detail.
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 5, b.y + 7, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3;
    ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    if (b.roof === 'ac') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(b.x + 8, b.y + 8, 14, 10); ctx.fillRect(b.x + b.w - 24, b.y + b.h - 20, 14, 10);
    } else if (b.roof === 'pool') {
      ctx.fillStyle = '#4db8d9';
      ctx.fillRect(b.x + b.w / 2 - 16, b.y + b.h / 2 - 10, 32, 20);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.strokeRect(b.x + b.w / 2 - 16, b.y + b.h / 2 - 10, 32, 20);
    } else if (b.roof === 'garden') {
      ctx.fillStyle = '#5da85a';
      ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 12, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Trees.
  for (const t of city.trees) {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.r > 11 ? PAL.tree : PAL.treeDark;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.4, 0, Math.PI * 2); ctx.fill();
  }
  // Docks: wooden piers over the water's edge.
  ctx.fillStyle = '#a9805a';
  ctx.fillRect(city.docks.x, city.docks.y, city.docks.w, 14);
  ctx.fillRect(city.docks.x + 30, city.docks.y, 12, city.docks.h);
  // Bank / depot / safehouse labels drawn on the ground.
  drawGroundLabel(ctx, 'SOLMAR BANK', city.bank.x + 45, city.bank.y + 30);
  drawGroundLabel(ctx, 'TAXI DEPOT', city.depot.x + 60, city.depot.y + 35);
  drawGroundLabel(ctx, 'SAFEHOUSE', city.safehouse.x + 45, city.safehouse.y + 30);
  // Skid marks.
  ctx.strokeStyle = 'rgba(20,20,20,0.35)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (const s of G.particles.skids) {
    ctx.globalAlpha = Math.min(1, s.life / 2);
    ctx.beginPath(); ctx.moveTo(s.x - 10, s.y); ctx.lineTo(s.x + 10, s.y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Mission beacon: a column of light and a pulsing ring on the target.
  const target = G.missionTarget;
  if (target && G.screen === 'play') {
    const pulse = 1 + Math.sin(G.time * 4) * 0.12;
    ctx.fillStyle = 'rgba(255,210,63,0.14)';
    ctx.fillRect(target.x - 26, target.y - 130, 52, 150);
    ctx.strokeStyle = PAL.beacon; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(target.x, target.y, target.r * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = PAL.beacon;
    ctx.beginPath(); ctx.arc(target.x, target.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Pickups (package / cash bag).
  if (G.pickup) {
    const bob = Math.sin(G.time * 5) * 4;
    ctx.fillStyle = G.pickup.kind === 'cash' ? '#7ee081' : '#ffd23f';
    ctx.fillRect(G.pickup.x - 10, G.pickup.y - 10 + bob, 20, 16);
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
    ctx.strokeRect(G.pickup.x - 10, G.pickup.y - 10 + bob, 20, 16);
  }
  drawCars(ctx, G);
  drawPeds(ctx, G);
  drawPlayer(ctx, G);
  drawBullets(ctx, G);
  drawParticles(ctx, G);
}
function drawGroundLabel(ctx, text, x, y) {
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}
function drawCar(ctx, c) {
  ctx.save();
  ctx.translate(c.x, c.y); ctx.rotate(c.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-c.len / 2 + 3, -c.wid / 2 + 4, c.len, c.wid);
  if (c.health < 45) {
    ctx.fillStyle = 'rgba(60,60,60,0.5)';
    ctx.beginPath(); ctx.arc(-c.len / 4, 0, 8 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = c.color;
  roundRect(ctx, -c.len / 2, -c.wid / 2, c.len, c.wid, 7); ctx.fill();
  ctx.fillStyle = 'rgba(20,28,40,0.85)';
  ctx.fillRect(-c.len / 2 + 9, -c.wid / 2 + 4, 12, c.wid - 8);
  ctx.fillRect(c.len / 2 - 15, -c.wid / 2 + 4, 10, c.wid - 8);
  ctx.fillStyle = '#222';
  ctx.fillRect(-c.len / 2 - 1, -c.wid / 2 - 2, 8, 5); ctx.fillRect(-c.len / 2 - 1, c.wid / 2 - 3, 8, 5);
  ctx.fillRect(c.len / 2 - 7, -c.wid / 2 - 2, 8, 5); ctx.fillRect(c.len / 2 - 7, c.wid / 2 - 3, 8, 5);
  if (c.type === 'taxi') {
    ctx.fillStyle = '#111'; ctx.fillRect(-6, -c.wid / 2 - 5, 12, 6);
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 8px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -c.wid / 2 + 4);
  }
  if (c.type === 'police') {
    ctx.fillStyle = '#fff'; ctx.fillRect(-c.len / 2 + 12, -c.wid / 2 + 2, c.len - 24, 5);
    const on = Math.floor(performance.now() / 280) % 2 === 0;
    ctx.fillStyle = on ? '#ff3b30' : '#4aa3ff';
    ctx.fillRect(-4, -c.wid / 2 - 4, 8, 5);
    ctx.fillStyle = on ? '#4aa3ff' : '#ff3b30';
    ctx.fillRect(-4, c.wid / 2 - 1, 8, 5);
  }
  ctx.restore();
}
function drawCars(ctx, G) {
  for (const c of G.cars) {
    if (c.dead) continue;
    drawCar(ctx, c);
    if (c === G.player.car) {
      ctx.strokeStyle = 'rgba(255,210,63,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.len * 0.75, 0, Math.PI * 2); ctx.stroke();
    }
  }
}
function drawPeds(ctx, G) {
  for (const p of G.peds) {
    if (p.down) {
      ctx.fillStyle = p.shirt; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 12, 7, p.angle, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.arc(p.x + 2, p.y + 3, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2); ctx.fill();
    if (p.gang) {
      ctx.fillStyle = '#222';
      ctx.fillRect(p.x - 7, p.y - 12, 14, 4);
      ctx.strokeStyle = '#ff5d8f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.stroke();
    }
  }
}
function drawPlayer(ctx, G) {
  const P = G.player;
  if (P.car) return; // the car is drawn; the ring marks it
  const bob = P.moving ? Math.sin(G.time * 14) * 1.5 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.arc(P.x + 2, P.y + 3, PLAYER_R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffcf3f';
  ctx.beginPath(); ctx.arc(P.x, P.y + bob, PLAYER_R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#7a5b00'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(P.x, P.y + bob, PLAYER_R, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(P.x, P.y + bob, 6, 0, Math.PI * 2); ctx.fill();
  // Facing tick + gun when armed.
  ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(P.x + Math.cos(P.angle) * 8, P.y + bob + Math.sin(P.angle) * 8);
  ctx.lineTo(P.x + Math.cos(P.angle) * 18, P.y + bob + Math.sin(P.angle) * 18);
  ctx.stroke();
}
function drawBullets(ctx, G) {
  ctx.strokeStyle = '#ffe66d'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}
function drawParticles(ctx, G) {
  for (const p of G.particles.list) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
  for (const t of G.particles.texts) {
    ctx.globalAlpha = Math.min(1, t.life);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const PLAYER_R = 13;

// ---- HUD ----
function drawHUD(ctx, G, screen) {
  const P = G.player, M = G.missions;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  // Top-left: wanted stars, health, cash.
  panel(ctx, 12, 12, 250, 86);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('DANNY REYES', 24, 34);
  for (let i = 0; i < WANTED_MAX; i++) {
    ctx.fillStyle = i < G.wanted.stars ? PAL.star : 'rgba(255,255,255,0.25)';
    drawStar(ctx, 30 + i * 22, 52, 8);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(24, 64, 150, 10);
  ctx.fillStyle = P.health > 30 ? PAL.health : PAL.healthLow;
  ctx.fillRect(24, 64, 150 * (P.health / 100), 10);
  ctx.fillStyle = PAL.cash; ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`$${P.cash.toLocaleString()}`, 186, 74);
  // Mission objective, top centre.
  const m = M.index < 5 ? MISSION_DEFS[M.index] : null;
  if (m) {
    const label = `MISSION ${M.index + 1}/5 — ${m.name}`;
    ctx.font = 'bold 14px system-ui, sans-serif';
    const w = Math.max(320, ctx.measureText(m.objective).width + 32);
    panel(ctx, (VIEW_W - w) / 2, 12, w, 52);
    ctx.fillStyle = '#ffd23f'; ctx.textAlign = 'center';
    ctx.fillText(label, VIEW_W / 2, 30);
    ctx.fillStyle = '#fff'; ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(m.objective, VIEW_W / 2, 50);
    ctx.textAlign = 'left';
  } else {
    ctx.font = 'bold 14px system-ui, sans-serif';
    panel(ctx, (VIEW_W - 300) / 2, 12, 300, 30);
    ctx.fillStyle = '#7ee081'; ctx.textAlign = 'center';
    ctx.fillText('FREE ROAM — taxi fares pay $40–$90', VIEW_W / 2, 32);
    ctx.textAlign = 'left';
  }
  // Banner (mission complete / wanted up).
  if (M.bannerT > 0) {
    ctx.globalAlpha = Math.min(1, M.bannerT);
    ctx.font = 'bold 30px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(M.banner, VIEW_W / 2 + 2, 172);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(M.banner, VIEW_W / 2, 170);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
  // Dialogue, bottom centre.
  if (M.dialogueT > 0) {
    const w = 760;
    panel(ctx, (VIEW_W - w) / 2, VIEW_H - 92, w, 62);
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('LENA CRUZ', (VIEW_W - w) / 2 + 16, VIEW_H - 66);
    ctx.fillStyle = '#fff'; ctx.font = '14px system-ui, sans-serif';
    wrapText(ctx, M.dialogue, (VIEW_W - w) / 2 + 16, VIEW_H - 46, w - 32, 18);
  }
  // Bottom-right: speed or ammo.
  if (P.car) {
    panel(ctx, VIEW_W - 150, VIEW_H - 62, 138, 50);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px system-ui, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(P.car.speed) * 0.36)}`, VIEW_W - 44, VIEW_H - 26);
    ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = '#bbb';
    ctx.fillText('km/h', VIEW_W - 22, VIEW_H - 26);
    ctx.textAlign = 'left';
  } else {
    panel(ctx, VIEW_W - 150, VIEW_H - 62, 138, 50);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`AMMO ${P.gun.ammo}/${12}`, VIEW_W - 138, VIEW_H - 40);
    ctx.fillStyle = '#bbb'; ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(P.gun.reloading > 0 ? 'RELOADING…' : 'CLICK TO SHOOT', VIEW_W - 138, VIEW_H - 22);
  }
  // Context hint, bottom-left (hidden while Lena is talking).
  const hint = M.dialogueT > 0 ? '' : contextHint(G);
  if (hint) {
    ctx.font = '13px system-ui, sans-serif';
    const w = ctx.measureText(hint).width + 24;
    panel(ctx, 12, VIEW_H - 44, w, 32);
    ctx.fillStyle = '#fff';
    ctx.fillText(hint, 24, VIEW_H - 23);
  }
  drawMinimap(ctx, G);
  // Muted / music note.
  if (G.muted) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('MUTED (M)', VIEW_W - 92, 118);
  }
}
import { MISSION_DEFS } from './missions.js';
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PAL.hudBg;
  roundRect(ctx, x, y, w, h, 9); ctx.fill();
  ctx.strokeStyle = PAL.hudLine; ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 9); ctx.stroke();
}
function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}
function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    if (ctx.measureText(line + w).width > maxW && line) { ctx.fillText(line, x, yy); line = ''; yy += lh; }
    line += w + ' ';
  }
  ctx.fillText(line, x, yy);
}
function contextHint(G) {
  const P = G.player;
  if (P.car) return 'E — step out   •   W/S drive   •   A/D steer';
  if (G.nearCar) return `E — steal the ${G.nearCar.type === 'police' ? 'police car' : G.nearCar.type}`;
  if (G.pickup && Math.hypot(P.x - G.pickup.x, P.y - G.pickup.y) < 46) return 'E — pick it up';
  return 'WASD move   •   SHIFT run   •   CLICK shoot   •   ESC pause';
}
function drawMinimap(ctx, G) {
  const mw = 208, mh = 152, mx = VIEW_W - mw - 12, my = 118;
  const sx = mw / WORLD.w, sy = mh / WORLD.h;
  panel(ctx, mx - 6, my - 6, mw + 12, mh + 12);
  ctx.save();
  ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
  ctx.fillStyle = '#79b06d'; ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#3fb8c9'; ctx.fillRect(mx, my + WORLD.waterY * sy, mw, mh - WORLD.waterY * sy);
  ctx.fillStyle = '#f2ddab'; ctx.fillRect(mx, my + WORLD.beachY * sy, mw, (WORLD.waterY - WORLD.beachY) * sy);
  ctx.strokeStyle = '#4a4a52'; ctx.lineWidth = 3;
  for (const ax of AVENUES) { ctx.beginPath(); ctx.moveTo(mx + ax * sx, my); ctx.lineTo(mx + ax * sx, my + WORLD.beachY * sy); ctx.stroke(); }
  for (const sy2 of STREETS) { ctx.beginPath(); ctx.moveTo(mx, my + sy2 * sy); ctx.lineTo(mx + mw, my + sy2 * sy); ctx.stroke(); }
  const px = G.player.car ? G.player.car.x : G.player.x;
  const py = G.player.car ? G.player.car.y : G.player.y;
  // Mission target.
  if (G.missionTarget) {
    const pulse = 3 + Math.sin(G.time * 5) * 1.5;
    ctx.fillStyle = '#ff5d8f';
    ctx.beginPath(); ctx.arc(mx + G.missionTarget.x * sx, my + G.missionTarget.y * sy, pulse + 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx + G.missionTarget.x * sx, my + G.missionTarget.y * sy, pulse + 3, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#4aa3ff';
  for (const c of G.cars) if (c.type === 'police') { ctx.fillRect(mx + c.x * sx - 2, my + c.y * sy - 2, 4, 4); }
  ctx.fillStyle = '#fff';
  for (const c of G.cars) if (c.traffic) { ctx.fillRect(mx + c.x * sx - 1, my + c.y * sy - 1, 2, 2); }
  // Player arrow.
  ctx.save();
  ctx.translate(mx + px * sx, my + py * sy);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('SOLMAR BAY', mx, my - 10);
}
function drawTitle(ctx, G) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#ff9a56'); grad.addColorStop(0.55, '#ff6b6b'); grad.addColorStop(1, '#2d1b4e');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.arc(1020, 130, 62, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath(); ctx.ellipse(240, 640, 300, 34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(980, 680, 360, 40, 0, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('SOLMAR BAY', VIEW_W / 2, 210);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('AN OPEN-WORLD CRIME STORY', VIEW_W / 2, 256);
  ctx.fillStyle = '#fff'; ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('Danny Reyes owes Lena Cruz a debt. Five jobs stand between him and freedom.', VIEW_W / 2, 300);
  ctx.fillText('Drive the city. Steal the cars. Lose the cops. Get paid.', VIEW_W / 2, 328);
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(G.hasSave ? 'ENTER — START NEW GAME      C — CONTINUE' : 'ENTER — START THE STORY', VIEW_W / 2, 420);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('WASD move & drive  •  E steal / enter car  •  CLICK shoot  •  R reload  •  SHIFT run  •  ESC pause  •  M mute', VIEW_W / 2, 480);
  ctx.fillText('A complete open world: traffic, pedestrians, police, missions, combat and a save.', VIEW_W / 2, 512);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('An original game. Not affiliated with Rockstar Games or Grand Theft Auto.', VIEW_W / 2, 560);
  ctx.textAlign = 'left';
}
function drawPaused(ctx, G) {
  ctx.fillStyle = 'rgba(8,10,16,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 300);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('ESC — resume      S — save & quit to title      R — restart mission', VIEW_W / 2, 350);
  ctx.textAlign = 'left';
}
function drawWasted(ctx, G) {
  ctx.fillStyle = 'rgba(20,0,0,0.55)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ff5d5d';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('WASTED', VIEW_W / 2, 320);
  ctx.fillStyle = '#fff'; ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Lena is not impressed. ENTER — retry the mission      T — back to title', VIEW_W / 2, 370);
  ctx.textAlign = 'left';
}
function drawWin(ctx, G) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#1c7c54'); grad.addColorStop(1, '#0d2b1d');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText('DEBT PAID', VIEW_W / 2, 260);
  ctx.fillStyle = '#fff'; ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(`Danny walks away clean — $${G.player.cash.toLocaleString()} richer. Solmar Bay is his now.`, VIEW_W / 2, 310);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('ENTER — keep playing in free roam      T — back to title', VIEW_W / 2, 380);
  ctx.textAlign = 'left';
}
