// SOLMAR BAY — the game itself: state, loop, screens, missions wiring, shot
// staging, and the window.__solmar handle the playtests drive.

import { WORLD_W, WORLD_H, PLAYER_START, TAXI_SPOT, COMET_SPOT, PIER, MISSION_PAY } from './config.js';
import { makeRng } from './random.js';
import { createCity, collideCircle, randomRoadPoint } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updateOnFoot, nearestEnterableCar, exitCar, hurtPlayer, syncCarToPlayer } from './player.js';
import { createCar, driveCar, updateTraffic, spawnTraffic, spawnParked, damageCar } from './cars.js';
import { createPed, spawnWalkers, spawnGang, updatePeds } from './peds.js';
import { createWanted, setWanted, addHeat, updateWanted, updatePolice } from './police.js';
import { createBullet, updateBullets, playerShoot, updateGun } from './combat.js';
import { createMissions, missionName, updateMissions, missionInteract, currentTarget, startMission } from './missions.js';
import { createParticles, addParticles, addFloat, updateParticles } from './particles.js';
import { saveGame, loadGame } from './save.js';
import { createRenderer, updateCamera, render } from './render.js';

const params = new URLSearchParams(location.search);
const SEED = parseInt(params.get('seed') ?? '', 10);
const DEBUG = params.get('debug') === '1';
const SHOT = params.get('shot');

export function createGame(canvas) {
  const seed = Number.isFinite(SEED) ? SEED : (Date.now() % 100000);
  const rng = makeRng(seed);
  const city = createCity(seed);
  const input = createInput(canvas);
  const audio = createAudio();
  const renderer = createRenderer(canvas);

  const G = {
    seed,
    rng,
    city,
    input,
    audio,
    renderer,
    screen: 'title',
    time: 0,
    player: createPlayer(PLAYER_START.x, PLAYER_START.y),
    cars: [],
    peds: [],
    bullets: [],
    particles: createParticles(),
    wanted: createWanted(),
    missions: createMissions(),
    missionTarget: null,
    pickup: null,
    policeSpawnT: 0,
    shotsFiredAt: 0,
    nearestCar: null,
    shotMode: SHOT,
    shotReady: false,
    paused: false,
    // Helpers the modules call back through (keeps imports acyclic).
    addParticles: (x, y, kind, n) => addParticles(G, x, y, kind, n),
    addFloat: (x, y, text, color) => addFloat(G, x, y, text, color),
    fireBullet: (x, y, angle, owner, dmg) => G.bullets.push(createBullet(x, y, angle, owner, dmg)),
    hurtPlayer: (dmg) => {
      if (hurtPlayer(G.player, dmg) && G.screen === 'play') G.screen = 'dead';
    },
    addHeatSilent: (amt) => addHeat(G, amt),
    cityCollide: (x, y, r) => collideCircle(G.city, x, y, r),
    saveGame: () => saveGame(G),
  };

  // --- The world: mission vehicles, parked cars, traffic, walkers. ---
  const taxi = spawnParked(G, TAXI_SPOT.x, TAXI_SPOT.y, 'taxi', 0);
  taxi.taxi = true;
  G.cars.push(taxi);
  const comet = spawnParked(G, COMET_SPOT.x, COMET_SPOT.y, 'sports', 0);
  comet.comet = true;
  comet.name = 'Comet GT';
  G.cars.push(comet);
  // A few more parked cars in the lots (kept off the M1 route and the story spots).
  const parkedSpots = [
    { x: 1150, y: 240, type: 'sedan' },
    { x: 1210, y: 240, type: 'sports' },
    { x: 600, y: 1450, type: 'sedan' },
    { x: 660, y: 1450, type: 'truck' },
    { x: 1850, y: 1060, type: 'sedan' },
    { x: 1910, y: 1060, type: 'taxi' },
  ];
  for (const s of parkedSpots) G.cars.push(spawnParked(G, s.x, s.y, s.type, 0));
  for (let i = 0; i < 14; i++) {
    const pt = randomRoadPoint(city, rng, G.player.x, G.player.y, 250);
    G.cars.push(spawnTraffic(G, pt.x, pt.y));
  }
  spawnWalkers(G, 24);

  // A save only resumes plain play; debug and screenshot runs start fresh.
  if (!DEBUG && !SHOT) {
    const save = loadGame();
    if (save) {
      G.player.cash = save.cash;
      if (save.missionIndex > 0 && save.missionIndex < 5) startMission(G, save.missionIndex);
    }
  }

  // Debug / test handle.
  G.debug = { startMission: (n) => startMission(G, n) };
  window.__solmar = G;

  if (SHOT) stageShot(G, SHOT);
  return G;
}

function stageShot(G, name) {
  const P = G.player;
  if (name === 'start') {
    G.screen = 'title';
    P.x = 1200;
    P.y = 900;
  } else if (name === 'drive') {
    G.screen = 'play';
    G.missions.index = 0;
    G.missions.stage = 'taxi';
    const taxi = G.cars.find((c) => c.taxi);
    P.x = taxi.x;
    P.y = taxi.y;
    enterCar(G, taxi);
    taxi.x = 900;
    taxi.y = 1213;
    taxi.angle = 0;
    taxi.speed = 150;
    P.x = taxi.x;
    P.y = taxi.y;
  } else if (name === 'chase') {
    G.screen = 'play';
    // The chase is the M3 escape, so the HUD names that job.
    G.missions.index = 2;
    G.missions.stage = 'evade';
    const comet = G.cars.find((c) => c.comet);
    P.x = comet.x;
    P.y = comet.y;
    enterCar(G, comet);
    comet.x = 1200;
    comet.y = 1213;
    comet.angle = 0;
    comet.speed = 220;
    P.x = comet.x;
    P.y = comet.y;
    setWanted(G, 3);
    const cop1 = createCar('police', 1020, 1213, 0);
    cop1.speed = 200;
    const cop2 = createCar('police', 1060, 1265, 0.3);
    cop2.speed = 190;
    G.cars.push(cop1, cop2);
  } else if (name === 'mission') {
    G.screen = 'play';
    startMission(G, 3);
    P.x = 1980;
    P.y = 1290;
    P.angle = Math.atan2(1340 - 1290, 2080 - 1980);
  }
  updateCamera(G);
}

// Put the player behind the wheel of a car.
export function enterCar(G, car) {
  const P = G.player;
  P.car = car;
  car.driver = 'player';
  car.parked = false;
  car.traffic = false;
  P.x = car.x;
  P.y = car.y;
  P.angle = car.angle;
}

function tryEnterCar(G) {
  const P = G.player;
  const m = G.missions;
  // During the taxi job, the yellow cab is the car — prefer it over traffic.
  let car = null;
  if (m.index === 0 && m.stage === 'taxi') {
    car = G.cars.find((c) => c.taxi && !c.dead && c.health > 0 && Math.hypot(c.x - P.x, c.y - P.y) < 70) ?? null;
  }
  car = car ?? nearestEnterableCar(P, G.cars);
  if (!car) return false;
  const wasParked = car.parked;
  enterCar(G, car);
  if (car.comet && m.index === 2 && m.stage === 'steal') {
    setWanted(G, 3);
    m.stage = 'evade';
    G.addFloat(P.x, P.y - 26, 'STOLEN! 3 STARS', '#ff5a5a');
  } else if (wasParked && car.type !== 'taxi') {
    addHeat(G, 0.5); // boosting a parked car draws the law's eye
  } else if (!wasParked && car.traffic) {
    addHeat(G, 1); // carjacking in traffic
  }
  return true;
}

function tryExitOrSwapCar(G) {
  const P = G.player;
  const cur = P.car;
  if (!cur) return;
  // E beside another car swaps into it (the M3 steal needs this).
  let other = null;
  let bd = 52 * 52;
  for (const c of G.cars) {
    if (c === cur || c.dead || c.health <= 0) continue;
    if (c.type === 'police' && c.police) continue;
    const d = (c.x - P.x) ** 2 + (c.y - P.y) ** 2;
    if (d < bd) { bd = d; other = c; }
  }
  if (other) {
    exitCar(P, cur);
    enterCar(G, other);
    if (other.comet && G.missions.index === 2 && G.missions.stage === 'steal') {
      setWanted(G, 3);
      G.missions.stage = 'evade';
      G.addFloat(P.x, P.y - 26, 'STOLEN! 3 STARS', '#ff5a5a');
    }
  } else {
    exitCar(P, cur);
  }
}

function respawn(G) {
  const P = G.player;
  P.health = 100;
  P.dead = false;
  P.cash = Math.max(0, P.cash - 50);
  if (P.car) { P.car.driver = null; P.car = null; }
  P.x = PLAYER_START.x;
  P.y = PLAYER_START.y;
  setWanted(G, 0);
  G.screen = 'play';
}

function update(G, dt) {
  G.time += dt;
  const input = G.input;
  const P = G.player;

  if (G.screen === 'title') {
    if (input.wasPressed('Enter')) {
      G.screen = 'play';
      G.audio.ensure();
      G.audio.startMusic();
    }
    // Slow scenic pan behind the title.
    P.x = 1200 + Math.sin(G.time * 0.05) * 200;
    P.y = 900;
    updateCamera(G);
    return;
  }
  if (G.screen === 'win') {
    if (input.wasPressed('Enter')) {
      G.screen = 'play';
      G.missions.index = 5;
      G.missions.stage = 'free';
      setWanted(G, 0);
    }
    return;
  }
  if (G.screen === 'dead') {
    if (input.wasPressed('Enter')) respawn(G);
    return;
  }

  // --- play ---
  syncCarToPlayer(G);
  if (input.wasPressed('KeyM')) G.audio.toggleMute();
  if (input.wasPressed('KeyE')) {
    if (!missionInteract(G)) {
      if (P.car) tryExitOrSwapCar(G);
      else tryEnterCar(G);
    }
  }
  if (input.wasPressed('KeyR') && P.gun.ammo < P.gun.maxAmmo && P.gun.reloading <= 0) {
    P.gun.reloading = 1.1;
  }
  if (input.mouse.down || input.mouse.clicked) playerShoot(G);

  if (P.car) driveCar(G, P.car, input, dt);
  else updateOnFoot(G, P, input, dt);
  if (P.car) { P.x = P.car.x; P.y = P.car.y; P.angle = P.car.angle; }

  updateTraffic(G, dt);
  updatePolice(G, dt);
  updateWanted(G, dt);
  updatePeds(G, dt);
  updateBullets(G, dt);
  updateGun(G, dt);
  updateMissions(G, dt);
  updateParticles(G, dt);

  G.shotsFiredAt = Math.max(0, G.shotsFiredAt - dt);
  G.missionTarget = currentTarget(G);
  G.nearestCar = P.car ? null : nearestEnterableCar(P, G.cars);
  updateCamera(G);
  if (P.car) G.audio.setEngine(P.car.speed, 300);
  else G.audio.setEngine(0, 300);

  if (P.dead) G.screen = 'dead';
}

export function start() {
  const canvas = document.getElementById('game');
  const fit = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const G = window.__solmar;
    if (G) {
      G.renderer.viewW = canvas.width;
      G.renderer.viewH = canvas.height;
    }
  };
  window.addEventListener('resize', fit);
  fit();
  const G = createGame(canvas);
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(G, dt);
    render(G);
    G.input.endFrame();
    if (G.shotMode && !G.shotReady) {
      G.shotReady = true;
      window.__shotReady = true;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// Boot when the page loads.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

export { missionName, MISSION_PAY, PIER };
