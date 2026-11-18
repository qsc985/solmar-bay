// SOLMAR BAY — boot and the one loop. The world advances in fixed 1/60 s
// steps; the renderer paints what is there. Screens: title, play, paused,
// wasted, win. ?seed=N fixes the city. ?shot=start|drive|chase|mission
// (&seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady. ?debug=1 exposes window.__solmar for
// automated playtests.
import { STEP, WORLD, PAL, CAR_HEALTH, CRIME_CAR_THEFT, CRIME_HIT_PED, CRIME_SHOOT, CRIME_KILL_COP, TRAFFIC_COUNT, PED_COUNT, PISTOL_DAMAGE } from './config.js';
import { createRandom, clamp } from './random.js';
import { createCity, STREETS } from './city.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_INTERACT, ACTION_RELOAD, ACTION_MUTE } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updateOnFoot, nearestEnterableCar, exitCar, hurtPlayer, healPlayer } from './player.js';
import { makeCar, spawnTrafficCar, updateTraffic, updateDriven, collideCars } from './cars.js';
import { makePed, updatePeds } from './peds.js';
import { createWanted, addCrime, updateWanted, spawnPolice, updatePoliceCar } from './police.js';
import { createBullets, fireBullet, updateGun, reloadGun, updateBullets } from './combat.js';
import { createParticles, puff, skid, floatText, updateParticles } from './particles.js';
import { createMissions, currentMission, missionTarget, setBanner, setDialogue, updateMissions, startFare, MISSION_DEFS } from './missions.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_WASTED, SCREEN_WIN } from './render.js';
import { saveGame, loadGame, hasSave } from './save.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const rng = createRandom(seed);
const city = createCity(rng);
const audio = createAudio();
const input = createInput(canvas);
const renderer = createRenderer(canvas);
renderer.resize();
window.addEventListener('resize', () => renderer.resize());

// The whole game state. Playtests read this through window.__solmar, so the
// field names are part of the contract: don't rename them.
const G = {
  rng, city, audio, input, renderer, seed,
  time: 0,
  screen: SCREEN_TITLE,
  hasSave: hasSave(),
  player: createPlayer(500, 500),
  cars: [],
  peds: [],
  bullets: createBullets(),
  particles: createParticles(),
  missions: createMissions(),
  wanted: createWanted(),
  missionTarget: null,
  pickup: null,
  nearCar: null,
  lastShot: null,
  muted: false,
  fare: null,
  gangSpawned: false,
  stats: { shots: 0, pedHits: 0, carHits: 0, playerHits: 0, wall: 0, expired: 0 },
};

function resetWorld() {
  G.cars = [];
  G.peds = [];
  G.bullets = createBullets();
  G.particles = createParticles();
  G.wanted = createWanted();
  G.gangSpawned = false;
  G.fare = null;
  G.pickup = null;
  // Parked cars in the open lots.
  for (const lot of city.lots.slice(0, 8)) {
    G.cars.push(makeCar(G.rng.pick(['sedan', 'van', 'sedan', 'truck']), lot.x + 20, lot.y + 10, 0, { parked: true }));
  }
  // Traffic.
  for (let i = 0; i < TRAFFIC_COUNT; i++) G.cars.push(spawnTrafficCar(G.rng, city));
  // Pedestrians.
  for (let i = 0; i < PED_COUNT; i++) G.peds.push(makePed(G.rng, city));
}

function startMission(i) {
  const m = MISSION_DEFS[i];
  G.missions.index = i;
  G.missions.stage = m.kind === 'fetch' || m.kind === 'score' ? 'pickup' : 'go';
  G.missions.killed = 0;
  G.gangSpawned = false;
  G.player.x = m.start.x;
  G.player.y = m.start.y;
  if (G.player.car) {
    G.player.car.driver = null;
    G.player.car = null;
  }
  G.player.health = 100;
  G.wanted = createWanted();
  G.cars = G.cars.filter((c) => !c.police);
  // Mission vehicles: a taxi at the depot for M1, the red Comet GT at the
  // showroom for M3. The depot lot sits mid-block, so the taxi parks on the
  // street beside it (12th St, eastbound lane) — otherwise it spawns facing a
  // rooftop with no clear exit to a road.
  if (m.id === 'fare') {
    G.cars.push(makeCar('taxi', city.depot.x + 60, STREETS[4] + 13, 0, { parked: true }));
  }
  if (m.id === 'wheels') {
    const gt = makeCar('sports', 1700, 700, 0, { parked: true, color: '#d7263d' });
    gt.missionCar = true;
    G.cars.push(gt);
  }
  G.pickup = null;
  if (m.pickup) {
    G.pickup = { x: m.pickup.x, y: m.pickup.y, kind: m.id === 'score' ? 'cash' : 'package', r: m.pickup.r };
  }
  setDialogue(G.missions, m.brief, 6);
  updateMissionTarget();
}

function updateMissionTarget() {
  const M = G.missions;
  if (M.index >= 5) {
    G.missionTarget = G.fare ? G.fare.to : null;
    return;
  }
  const m = currentMission(M);
  if (!m) {
    G.missionTarget = null;
    return;
  }
  if (m.id === 'fare' && M.stage === 'go') G.missionTarget = { x: city.depot.x + 60, y: STREETS[4] + 13, r: 60 };
  else if (m.id === 'wheels' && M.stage === 'go') G.missionTarget = m.target;
  else if (m.id === 'payback' && !G.gangSpawned) G.missionTarget = m.target;
  else G.missionTarget = missionTarget(M);
}

function completeMission() {
  const m = currentMission(G.missions);
  if (!m) return;
  G.player.cash += m.reward;
  healPlayer(G.player, 40); // patched up between jobs
  audio.cash();
  setBanner(G.missions, `MISSION COMPLETE — +$${m.reward}`);
  floatText(G.particles, G.player.x, G.player.y - 30, `+$${m.reward}`, PAL.cash);
  saveGame(G);
  G.missions.index += 1;
  if (G.missions.index >= 5) {
    G.screen = SCREEN_WIN;
    audio.mission();
    return;
  }
  startMission(G.missions.index);
}

function retryMission() {
  const m = currentMission(G.missions);
  if (!m) {
    G.screen = SCREEN_TITLE;
    return;
  }
  G.player.health = 100;
  G.missions.killed = 0;
  G.gangSpawned = false;
  G.peds = G.peds.filter((p) => !p.gang);
  startMission(G.missions.index);
  G.screen = SCREEN_PLAY;
}

// ---- the per-frame update ----

function update(dt) {
  G.time += dt;
  const P = G.player;
  const M = G.missions;
  updateMissions(M, dt);
  updateParticles(G.particles, dt);
  updateGun(P.gun, dt);
  audio.update(dt);

  updatePolice(dt, P);
  if (P.car) updateDriving(dt, P);
  else updateWalking(dt, P);
  updateCars(dt, P);
  updateCarPedHits(P);
  updatePedsAndGunfire(dt, P);
  updateBulletsNow(dt, P);
  checkMission();
  input.endFrame();
}

function updatePolice(dt, P) {
  const policeNear = G.cars.some((c) => c.type === 'police' && Math.hypot(c.x - P.x, c.y - P.y) < 520);
  updateWanted(G.wanted, dt, policeNear);
  const wantCount = G.wanted.stars;
  const policeCars = G.cars.filter((c) => c.type === 'police');
  if (policeCars.length < wantCount) {
    for (const pc of spawnPolice(G.rng, city, P.x, P.y, wantCount - policeCars.length)) G.cars.push(pc);
    if (wantCount > 0) audio.siren(true);
  }
  if (policeCars.length > wantCount) {
    for (let i = policeCars.length - 1; i >= wantCount; i--) {
      const c = policeCars[i];
      if (Math.hypot(c.x - P.x, c.y - P.y) > 800) G.cars.splice(G.cars.indexOf(c), 1);
    }
  }
  if (wantCount === 0) audio.siren(false);
}

function updateDriving(dt, P) {
  const car = P.car;
  const { drifting } = updateDriven(car, input, dt, audio);
  P.x = car.x;
  P.y = car.y;
  P.angle = car.angle;
  if (drifting) {
    skid(G.particles, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, car.angle);
  }
  if (Math.random() < dt * 8 && Math.abs(car.speed) > 120) {
    puff(G.particles, car.x - Math.cos(car.angle) * car.len / 2, car.y - Math.sin(car.angle) * car.len / 2, 1, 'rgba(120,120,120,0.5)', 30, 0.5, 5);
  }
  const c = city.collideCircle(car.x, car.y, car.len / 2 - 4);
  if (c.hit && Math.abs(car.speed) > 150) {
    car.health -= 8;
    car.speed *= 0.5;
    audio.crash();
    renderer.cam.shake = 0.7;
    puff(G.particles, car.x, car.y, 8, '#ffb347', 120, 0.5, 4);
  }
  car.x = c.x;
  car.y = c.y;
  if (car.health <= 0 && !car.dead) {
    car.dead = true;
    puff(G.particles, car.x, car.y, 40, '#ff6b35', 260, 0.9, 6);
    puff(G.particles, car.x, car.y, 20, '#333', 120, 1.4, 8);
    audio.crash();
    renderer.cam.shake = 1;
    exitCar(P, car);
    hurtPlayer(P, 15);
  }
  if (input.takePressed(ACTION_INTERACT)) exitCar(P, car);
}

function updateWalking(dt, P) {
  updateOnFoot(P, input, dt, city);
  G.nearCar = nearestEnterableCar(P, G.cars);
  if (input.takePressed(ACTION_INTERACT)) {
    if (G.pickup && Math.hypot(P.x - G.pickup.x, P.y - G.pickup.y) < 52) {
      collectPickup();
    } else if (G.nearCar) {
      enterCar(G.nearCar);
    }
  }
  // Shooting: the mouse aims in world space.
  const rect = canvas.getBoundingClientRect();
  const scaleX = 1280 / rect.width;
  const scaleY = 720 / rect.height;
  const wx = renderer.cam.x + input.mouse.x * scaleX;
  const wy = renderer.cam.y + input.mouse.y * scaleY;
  P.angle = Math.atan2(wy - P.y, wx - P.x);
  if (input.mouse.down) {
    const b = fireBullet(G.bullets, P.gun, P.x + Math.cos(P.angle) * 16, P.y + Math.sin(P.angle) * 16, P.angle, 'player');
    if (b) {
      G.stats.shots += 1;
      audio.shoot();
      G.lastShot = { x: P.x, y: P.y, t: G.time };
      puff(G.particles, P.x + Math.cos(P.angle) * 20, P.y + Math.sin(P.angle) * 20, 3, '#ffe66d', 90, 0.15, 3);
      if (G.wanted.stars < 1) addCrime(G.wanted, CRIME_SHOOT);
    }
  }
  if (input.takePressed(ACTION_RELOAD)) reloadGun(P.gun);
}

function updateCars(dt, P) {
  for (const car of G.cars) {
    if (car.dead) continue;
    if (car.type === 'police') updatePoliceCar(car, P.x, P.y, dt, city);
    else if (car.traffic) updateTraffic(car, dt, G.rng, city, G.cars, G.peds);
    else if (!car.parked && car !== P.car && Math.abs(car.speed) > 1) {
      car.speed *= 0.96;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
    }
  }
  // Car-car collisions.
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      const a = G.cars[i];
      const b = G.cars[j];
      if (a.dead || b.dead) continue;
      if (collideCars(a, b)) {
        puff(G.particles, (a.x + b.x) / 2, (a.y + b.y) / 2, 6, '#ffb347', 100, 0.4, 3);
        if (a === P.car || b === P.car) {
          audio.crash();
          renderer.cam.shake = 0.5;
          hurtPlayer(P, 4);
        }
      }
    }
  }
}

// Cars vs pedestrians: a fast car kills (a crime if it's the player's car);
// a slow car just shoves the ped aside — traffic shouldn't be a massacre.
function updateCarPedHits(P) {
  for (const car of G.cars) {
    if (car.dead || Math.abs(car.speed) < 40) continue;
    for (const p of G.peds) {
      if (p.down) continue;
      const dx = p.x - car.x;
      const dy = p.y - car.y;
      const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
      if (Math.abs(along) < car.len / 2 + 8 && Math.abs(side) < car.wid / 2 + 8) {
        if (Math.abs(car.speed) > 120) {
          p.down = true;
          p.health = 0;
          puff(G.particles, p.x, p.y, 10, '#e74c3c', 140, 0.6, 4);
          if (car === P.car) {
            addCrime(G.wanted, CRIME_HIT_PED);
            floatText(G.particles, p.x, p.y - 20, 'WANTED UP', '#ff5d5d');
          }
        } else {
          // Nudge the ped out of the car's way; they run off, unharmed.
          const s = side >= 0 ? 1 : -1;
          const nx = p.x + -Math.sin(car.angle) * s * 34;
          const ny = p.y + Math.cos(car.angle) * s * 34;
          const c = city.collideCircle(nx, ny, 10);
          p.x = c.x;
          p.y = c.y;
          if (!p.gang) {
            p.state = 'flee';
            p.fleeT = 1.5;
          }
        }
      }
    }
  }
}

function updatePedsAndGunfire(dt, P) {
  // Pedestrians (flee gunfire and fast cars; gang members shoot).
  const danger = {
    px: P.x, py: P.y, y: P.y, alive: P.health > 0,
    near(x, y, r) {
      if (G.lastShot && G.time - G.lastShot.t < 1.5 && Math.hypot(x - G.lastShot.x, y - G.lastShot.y) < r + 120) return true;
      if (P.car && Math.abs(P.car.speed) > 220 && Math.hypot(x - P.car.x, y - P.car.y) < r) return true;
      return false;
    },
    shootFrom(p) {
      const a = Math.atan2(P.y - p.y, P.x - p.x) + (Math.random() - 0.5) * 0.38;
      fireBullet(G.bullets, { ammo: 99, reloading: 0, cooldown: 0 }, p.x, p.y, a, 'gang', 8);
      audio.shoot();
      G.lastShot = { x: p.x, y: p.y, t: G.time };
    },
  };
  updatePeds(G.peds, dt, G.rng, city, danger);
  // Police at 3+ stars shoot from their cars when close.
  if (G.wanted.stars >= 3) {
    for (const c of G.cars) {
      if (c.type !== 'police' || c.dead) continue;
      const d = Math.hypot(P.x - c.x, P.y - c.y);
      if (d < 380) {
        c.shootCd = (c.shootCd ?? 1) - dt;
        if (c.shootCd <= 0) {
          c.shootCd = 1.6 + Math.random();
          const a = Math.atan2(P.y - c.y, P.x - c.x) + (Math.random() - 0.5) * 0.3;
          fireBullet(G.bullets, { ammo: 99, reloading: 0, cooldown: 0 }, c.x, c.y, a, 'police');
          audio.shoot();
        }
      }
    }
  }
}

function updateBulletsNow(dt, P) {
  updateBullets(G.bullets, dt, city, G.peds, G.cars, P, (kind, target, x, y, dmg = 12) => {
    if (kind === 'player') {
      G.stats.playerHits += 1;
      if (hurtPlayer(P, dmg)) {
        G.screen = SCREEN_WASTED;
        audio.crash();
      }
      puff(G.particles, x, y, 4, '#e74c3c', 80, 0.3, 3);
    } else if (kind === 'ped') {
      G.stats.pedHits += 1;
      target.health -= PISTOL_DAMAGE;
      puff(G.particles, x, y, 5, '#e74c3c', 100, 0.35, 3);
      if (target.health <= 0 && !target.down) {
        target.down = true;
        if (target.gang) {
          G.missions.killed += 1;
          floatText(G.particles, x, y - 20, `VIPER DOWN ${G.missions.killed}/4`, '#ff5d8f');
          if (G.missions.killed >= 4 && currentMission(G.missions)?.id === 'payback') completeMission();
        } else {
          addCrime(G.wanted, CRIME_HIT_PED);
        }
      }
    } else if (kind === 'car') {
      G.stats.carHits += 1;
      target.health -= PISTOL_DAMAGE;
      puff(G.particles, x, y, 5, '#ffb347', 90, 0.3, 3);
      if (target.health <= 0 && !target.dead) {
        target.dead = true;
        puff(G.particles, target.x, target.y, 36, '#ff6b35', 240, 0.9, 6);
        audio.crash();
        renderer.cam.shake = 0.9;
        if (target.type === 'police') addCrime(G.wanted, CRIME_KILL_COP);
        if (target === P.car) {
          exitCar(P, target);
          hurtPlayer(P, 15);
        }
      }
    }
  }, G.stats);
}

function enterCar(car) {
  const P = G.player;
  const wasOccupied = car.driver === 'traffic';
  P.car = car;
  car.driver = 'player';
  car.parked = false;
  car.traffic = false;
  P.x = car.x;
  P.y = car.y;
  if (wasOccupied) {
    // The driver flees on foot.
    const d = makePed(G.rng, city, {});
    d.x = car.x + 30;
    d.y = car.y + 30;
    d.state = 'flee';
    d.fleeT = 3;
    G.peds.push(d);
    addCrime(G.wanted, CRIME_CAR_THEFT);
    floatText(G.particles, car.x, car.y - 30, 'CAR STOLEN', '#ff5d5d');
    audio.crash();
  }
  const m = currentMission(G.missions);
  if (m?.id === 'wheels' && car.missionCar && G.missions.stage === 'go') {
    G.missions.stage = 'escape';
    addCrime(G.wanted, 44); // 2+ stars: the showroom alarm
    setDialogue(G.missions, 'Lena: "They saw you! Lose the cops — stay out of sight till the heat dies."', 6);
    updateMissionTarget();
  }
  if (m?.id === 'fare' && car.type === 'taxi' && G.missions.stage === 'go') {
    G.missions.stage = 'deliver';
    setDialogue(G.missions, 'Client: "The pier, please. And step on it — my boat leaves at noon."', 5);
    updateMissionTarget();
  }
}

function collectPickup() {
  const P = G.player;
  const m = currentMission(G.missions);
  if (!G.pickup || !m) return;
  audio.pickup();
  puff(G.particles, G.pickup.x, G.pickup.y, 12, '#ffd23f', 120, 0.6, 4);
  if (m.id === 'package') {
    G.missions.stage = 'deliver';
    setDialogue(G.missions, 'Lena: "Good. Now walk it to the docks — don\'t run, don\'t attract the cops."', 5);
  } else if (m.id === 'score') {
    G.missions.stage = 'escape';
    addCrime(G.wanted, 60); // 3 stars: the bank alarm
    setDialogue(G.missions, 'Lena: "Alarms! Three stars! Get to the safehouse — NOW."', 6);
  }
  G.pickup = null;
  updateMissionTarget();
}

function checkMission() {
  const M = G.missions;
  const P = G.player;
  if (M.index >= 5) {
    // Free roam: taxi fares.
    if (!G.fare && P.car?.type === 'taxi') {
      G.fare = startFare(G.rng, city);
      setBanner(M, `FARE — take the client to ${G.fare.to.name}`);
      updateMissionTarget();
    }
    if (G.fare && P.car && Math.hypot(P.car.x - G.fare.to.x, P.car.y - G.fare.to.y) < 70) {
      P.cash += G.fare.pay;
      audio.cash();
      floatText(G.particles, P.x, P.y - 30, `+$${G.fare.pay}`, PAL.cash);
      G.fare = null;
      updateMissionTarget();
    }
    return;
  }
  const m = currentMission(M);
  if (!m) return;
  const tx = G.missionTarget?.x ?? 0;
  const ty = G.missionTarget?.y ?? 0;
  const px = P.car ? P.car.x : P.x;
  const py = P.car ? P.car.y : P.y;
  const d = Math.hypot(px - tx, py - ty);
  if (m.id === 'fare' && M.stage === 'deliver' && d < 70) completeMission();
  else if (m.id === 'package' && M.stage === 'deliver' && d < 70) completeMission();
  else if (m.id === 'wheels' && M.stage === 'escape' && G.wanted.stars === 0) completeMission();
  else if (m.id === 'score' && M.stage === 'escape' && d < 80) completeMission();
  else if (m.id === 'payback' && !G.gangSpawned && d < 340) {
    G.gangSpawned = true;
    for (let i = 0; i < 4; i++) {
      G.peds.push(makePed(G.rng, city, {
        gang: true,
        x: 2080 + G.rng.range(-70, 70),
        y: 1340 + G.rng.range(-50, 50),
      }));
    }
    setDialogue(G.missions, 'Viper: "That\'s Lena\'s boy! Get him!"', 4);
    updateMissionTarget();
  }
  // Backstop for the fight: a Viper can also die under a police car's wheels,
  // which doesn't count as a player kill. The mission ends when all four are
  // down, however they got there — otherwise it can never complete.
  else if (m.id === 'payback' && G.gangSpawned && G.peds.some((p) => p.gang) && G.peds.every((p) => !p.gang || p.down)) {
    completeMission();
  }
}

// ---- screenshots: stage a scene, paint twice, signal readiness ----
function stageShot(name) {
  resetWorld();
  G.screen = SCREEN_PLAY;
  const P = G.player;
  if (name === 'start') {
    G.screen = SCREEN_TITLE;
    return;
  }
  if (name === 'drive') {
    startMission(0);
    const taxi = G.cars.find((c) => c.type === 'taxi');
    P.car = taxi;
    taxi.driver = 'player';
    taxi.parked = false;
    taxi.traffic = false;
    taxi.x = 1100;
    taxi.y = 700;
    taxi.angle = Math.PI / 2;
    taxi.speed = 300;
    P.x = taxi.x;
    P.y = taxi.y;
    P.angle = taxi.angle;
    G.missions.stage = 'deliver';
    updateMissionTarget();
    setDialogue(G.missions, 'Client: "The pier, please. And step on it — my boat leaves at noon."', 99);
  } else if (name === 'chase') {
    startMission(2);
    const gt = G.cars.find((c) => c.missionCar);
    P.car = gt;
    gt.driver = 'player';
    gt.parked = false;
    gt.x = 1400;
    gt.y = 700;
    gt.angle = 0;
    gt.speed = 380;
    P.x = gt.x;
    P.y = gt.y;
    P.angle = 0;
    addCrime(G.wanted, 60);
    for (const pc of spawnPolice(G.rng, city, P.x, P.y, 2)) G.cars.push(pc);
    G.cars.filter((c) => c.type === 'police').forEach((c, i) => {
      c.x = P.x - 160 - i * 60;
      c.y = P.y + (i ? 40 : -40);
    });
    G.missions.stage = 'escape';
    setDialogue(G.missions, 'Lena: "They saw you! Lose the cops — stay out of sight till the heat dies."', 99);
    updateMissionTarget();
  } else if (name === 'mission') {
    startMission(3);
    P.x = 1980;
    P.y = 1290;
    P.angle = 0.5;
    G.gangSpawned = true;
    for (let i = 0; i < 4; i++) {
      G.peds.push(makePed(G.rng, city, {
        gang: true,
        x: 2080 + G.rng.range(-70, 70),
        y: 1340 + G.rng.range(-50, 50),
      }));
    }
    setDialogue(G.missions, 'Viper: "That\'s Lena\'s boy! Get him!"', 99);
    updateMissionTarget();
  }
  // Snap the camera onto the player so both paints agree.
  renderer.cam.x = clamp(P.x - 640, -40, WORLD.w - 1240);
  renderer.cam.y = clamp(P.y - 360, -40, WORLD.h - 680);
}

function runShot(name) {
  stageShot(name);
  let painted = 0;
  function paint() {
    renderer.draw(G, G.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// ---- main loop ----
function runGame() {
  resetWorld();
  startMission(0);
  G.screen = SCREEN_TITLE;
  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    input.beginFrame();
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > 0.25) elapsed = 0.25;
    if (input.takePressed(ACTION_MUTE)) {
      G.muted = !G.muted;
      audio.setMuted(G.muted);
    }
    if (G.screen === SCREEN_TITLE) {
      audio.unlock();
      if (input.takePressed(ACTION_CONFIRM)) {
        audio.unlock();
        audio.startMusic();
        G.screen = SCREEN_PLAY;
        resetWorld();
        startMission(0);
      }
      if (input.down('KeyC') && G.hasSave) {
        const s = loadGame();
        if (s) {
          audio.unlock();
          audio.startMusic();
          G.player.cash = s.cash;
          G.player.health = s.health;
          resetWorld();
          startMission(Math.min(s.mission, 4));
          G.player.x = s.x;
          G.player.y = s.y;
          G.screen = SCREEN_PLAY;
        }
      }
      renderer.draw(G, G.screen);
      input.endFrame();
      return;
    }
    if (G.screen === SCREEN_PLAY) {
      if (input.takePressed(ACTION_PAUSE)) {
        G.screen = SCREEN_PAUSED;
        input.endFrame();
        renderer.draw(G, G.screen);
        return;
      }
      accumulator += elapsed;
      let n = 0;
      while (accumulator >= STEP && n < 5) {
        update(STEP);
        accumulator -= STEP;
        n++;
      }
      if (n === 5) accumulator = 0;
      if (G.screen !== SCREEN_PLAY) {
        renderer.draw(G, G.screen);
        return;
      }
      renderer.draw(G, G.screen);
      return;
    }
    if (G.screen === SCREEN_PAUSED) {
      if (input.takePressed(ACTION_PAUSE)) {
        G.screen = SCREEN_PLAY;
      } else if (input.down('KeyS')) {
        saveGame(G);
        G.screen = SCREEN_TITLE;
        G.hasSave = true;
      } else if (input.down('KeyR')) {
        retryMission();
      }
      renderer.draw(G, G.screen);
      input.endFrame();
      return;
    }
    if (G.screen === SCREEN_WASTED) {
      if (input.takePressed(ACTION_CONFIRM)) retryMission();
      else if (input.down('KeyT')) {
        G.screen = SCREEN_TITLE;
      }
      renderer.draw(G, G.screen);
      input.endFrame();
      return;
    }
    if (G.screen === SCREEN_WIN) {
      if (input.takePressed(ACTION_CONFIRM)) {
        G.screen = SCREEN_PLAY;
        G.missions.index = 5;
        G.wanted = createWanted(); // a clean start for free roam
        G.cars = G.cars.filter((c) => c.type !== 'police');
        updateMissionTarget();
      } else if (input.down('KeyT')) {
        G.screen = SCREEN_TITLE;
      }
      renderer.draw(G, G.screen);
      input.endFrame();
      return;
    }
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

// Debug handle for automated playtests (?debug=1): exposes the game state read-only.
if (params.get('debug') === '1') {
  window.__solmar = G;
  G.debug = { startMission, retryMission, completeMission };
}
