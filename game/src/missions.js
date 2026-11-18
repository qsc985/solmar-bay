// The story: five missions in a chain, each paying cash, shown as objectives.
// index = missions completed (0..5); stage = what the player must do right now.
// The playtests drive this exact machine, so the stage names and targets matter:
//   M1 'taxi'    -> drive the taxi to the pier
//   M2 'pickup'  -> walk to the package, E to take it; 'deliver' -> carry it to the pier
//   M3 'steal'   -> take the red Comet GT; 'evade' -> lose the 3-star heat
//   M4 'gang'    -> drop all four Vipers at the docks
//   M5 'grab'    -> take the bank cash, E; 'escape' -> reach the safehouse
//   index 5      -> free roam

import { PIER, PACKAGE_SPOT, BANK_CASH, SAFEHOUSE, MISSION_PAY, MISSION_NAMES } from './config.js';
import { spawnGang } from './peds.js';
import { setWanted } from './police.js';

export function createMissions() {
  return { index: 0, stage: 'taxi' };
}

export function missionName(G) {
  if (G.missions.index >= 5) return 'Free Roam';
  return MISSION_NAMES[G.missions.index];
}

export function missionObjective(G) {
  const m = G.missions;
  switch (m.index) {
    case 0: return 'M1 Taxi Driver — get in the yellow taxi and drive your fare to the pier';
    case 1: return m.stage === 'pickup'
      ? 'M2 The Package — walk to the package and press E to pick it up'
      : 'M2 The Package — carry the package to the pier';
    case 2: return m.stage === 'steal'
      ? 'M3 Grand Theft — steal the red Comet GT parked uptown'
      : 'M3 Grand Theft — lose the cops (3 stars) and the heat';
    case 3: return 'M4 Viper Hunt — drop all four Vipers at the docks';
    case 4: return m.stage === 'grab'
      ? 'M5 The Big Score — grab the bank cash (press E at the bank)'
      : 'M5 The Big Score — escape the 4-star heat: reach the safehouse';
    default: return 'Free roam — Solmar Bay is yours. Earn cash, steal cars, dodge the law.';
  }
}

// Where the pulsing objective marker points right now.
export function currentTarget(G) {
  const m = G.missions;
  switch (m.index) {
    case 0: return { ...PIER };
    case 1: return m.stage === 'pickup' ? { ...PACKAGE_SPOT } : { ...PIER };
    case 2: return m.stage === 'steal' ? { x: 1700, y: 700 } : null;
    case 3: return { x: 2080, y: 1340 };
    case 4: return m.stage === 'grab' ? { ...BANK_CASH } : { ...SAFEHOUSE };
    default: return null;
  }
}

function pay(G, n) {
  G.player.cash += MISSION_PAY[n];
  // A job done patches Danny up a little — the chain stays survivable.
  G.player.health = Math.min(100, G.player.health + 30);
  G.addFloat(G.player.x, G.player.y - 26, `+$${MISSION_PAY[n]}`, '#ffd23f');
  if (G.audio) G.audio.pickup();
  if (G.saveGame) G.saveGame();
}

export function updateMissions(G, dt) {
  const m = G.missions;
  const P = G.player;
  if (m.index >= 5) return;
  if (m.index === 0) {
    // M1: in the taxi, within range of the pier.
    if (P.car && P.car.type === 'taxi' && Math.hypot(P.x - PIER.x, P.y - PIER.y) < 80) {
      pay(G, 0);
      m.index = 1;
      m.stage = 'pickup';
      G.pickup = { ...PACKAGE_SPOT };
    }
  } else if (m.index === 1) {
    if (m.stage === 'deliver' && Math.hypot(P.x - PIER.x, P.y - PIER.y) < 80) {
      pay(G, 1);
      m.index = 2;
      m.stage = 'steal';
      G.pickup = null;
    }
  } else if (m.index === 2) {
    if (m.stage === 'evade' && G.wanted.stars <= 0) {
      pay(G, 2);
      m.index = 3;
      m.stage = 'gang';
      spawnGang(G, 2080, 1340);
    }
  } else if (m.index === 3) {
    const alive = G.peds.filter((p) => p.gang && !p.down).length;
    if (alive === 0 && G.peds.some((p) => p.gang)) {
      pay(G, 3);
      m.index = 4;
      m.stage = 'grab';
    }
  } else if (m.index === 4) {
    if (m.stage === 'escape' && Math.hypot(P.x - SAFEHOUSE.x, P.y - SAFEHOUSE.y) < 80) {
      pay(G, 4);
      m.index = 5;
      m.stage = 'free';
      setWanted(G, 0);
      G.screen = 'win';
      if (G.saveGame) G.saveGame();
    }
  }
}

// The E key: context action for the current mission stage.
export function missionInteract(G) {
  const m = G.missions;
  const P = G.player;
  if (m.index === 1 && m.stage === 'pickup' && G.pickup) {
    if (Math.hypot(P.x - G.pickup.x, P.y - G.pickup.y) < 60) {
      m.stage = 'deliver';
      G.pickup = null;
      if (G.audio) G.audio.pickup();
      return true;
    }
  }
  if (m.index === 4 && m.stage === 'grab') {
    if (Math.hypot(P.x - BANK_CASH.x, P.y - BANK_CASH.y) < 60) {
      m.stage = 'escape';
      setWanted(G, 4);
      G.addFloat(P.x, P.y - 26, 'BANK CASH!', '#ffd23f');
      if (G.audio) G.audio.pickup();
      return true;
    }
  }
  return false;
}

// Debug helper (used by the playtest diagnostics): jump to a mission.
export function startMission(G, n) {
  const m = G.missions;
  m.index = n;
  if (n === 0) { m.stage = 'taxi'; G.pickup = null; }
  if (n === 1) { m.stage = 'pickup'; G.pickup = { ...PACKAGE_SPOT }; }
  if (n === 2) { m.stage = 'steal'; G.pickup = null; }
  if (n === 3) {
    m.stage = 'gang';
    if (!G.peds.some((p) => p.gang)) spawnGang(G, 2080, 1340);
  }
  if (n === 4) { m.stage = 'grab'; G.pickup = null; }
  if (n >= 5) { m.stage = 'free'; }
}
