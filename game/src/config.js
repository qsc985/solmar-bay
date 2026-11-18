// SOLMAR BAY — shared constants: world, palette, vehicles, keys, mission pay.
// A sun-soaked fictional coastal city. All original names, no Rockstar material.

export const WORLD_W = 2400;
export const WORLD_H = 1800;

// Sea along the south edge; beach strip just north of it.
export const SEA_Y = 1700;
export const BEACH_Y = 1640;

// City road grid (roads are 64px wide, centred on these lines).
export const ROADS_H = [13, 313, 613, 913, 1213, 1513];
export const ROADS_V = [14, 264, 514, 764, 1014, 1264, 1514, 1764, 2014, 2264];
export const ROAD_HALF = 32;

// Named places (fixed so the story and the playtests always find them).
export const PIER = { x: 2050, y: 1560 }; // M1 drop-off, M2 delivery, M4 docks
export const DOCKS = { x: 2080, y: 1340 }; // Viper gang turf
export const TAXI_SPOT = { x: 560, y: 1213 }; // M1 taxi, parked on 12th St
export const COMET_SPOT = { x: 1700, y: 700 }; // red Comet GT, M3 target
export const PACKAGE_SPOT = { x: 1350, y: 950 }; // M2 package pickup
export const BANK_SPOT = { x: 1014, y: 560 }; // M5 bank (cash point just south of it)
export const BANK_CASH = { x: 1014, y: 640 };
export const SAFEHOUSE = { x: 300, y: 300 }; // M5 escape target
export const PLAYER_START = { x: 520, y: 1180 };

export const MISSION_PAY = [150, 200, 350, 500, 1000];
export const MISSION_NAMES = [
  'Taxi Driver',
  'The Package',
  'Grand Theft',
  'Viper Hunt',
  'The Big Score',
];

export const PLAYER_R = 13;
export const PLAYER_HEALTH = 100;
export const WALK_SPEED = 145;
export const RUN_SPEED = 225;

// Vehicle definitions: top speed (px/s), acceleration, turn rate, size, health.
export const CAR_TYPES = {
  sedan: { name: 'Sedan', maxSpeed: 205, accel: 210, turn: 2.6, len: 46, wid: 22, health: 100, color: '#5b7fa6' },
  taxi: { name: 'Taxi', maxSpeed: 225, accel: 225, turn: 2.7, len: 46, wid: 22, health: 100, color: '#f2b705' },
  sports: { name: 'Comet GT', maxSpeed: 330, accel: 300, turn: 3.1, len: 48, wid: 22, health: 90, color: '#d7263d' },
  truck: { name: 'Truck', maxSpeed: 160, accel: 160, turn: 2.0, len: 58, wid: 26, health: 160, color: '#7a6a53' },
  police: { name: 'Interceptor', maxSpeed: 285, accel: 280, turn: 3.0, len: 48, wid: 22, health: 120, color: '#1c2733' },
};

export const PAL = {
  grass: '#7fae5a',
  grassDark: '#6d9c4c',
  road: '#3d3d46',
  roadLine: '#d8d8c8',
  sidewalk: '#9a9a92',
  sea: '#2e7fb8',
  seaDeep: '#1f5f8f',
  beach: '#e8d9a0',
  building: ['#c96f4a', '#d9a441', '#7d8aa5', '#a5688f', '#5f8f7b', '#b5533c'],
  roof: ['#8a4a30', '#a67c2e', '#5c6a80', '#7d4a6b', '#46705e', '#8a3d2c'],
  tree: '#3f7a34',
  treeDark: '#2f5c28',
  wall: '#2b2b2b',
};

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  enterCar: ['KeyE'],
  reload: ['KeyR'],
  mute: ['KeyM'],
  pause: ['Escape', 'KeyP'],
};

export const SAVE_KEY = 'solmar-bay-save-v1';
