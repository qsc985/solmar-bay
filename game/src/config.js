// SOLMAR BAY — tuning and palette. One place for every number the game balances on.
export const WORLD = { w: 2600, h: 1900, beachY: 1760, waterY: 1852 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-bay-save-v1';

// Player on foot
export const WALK_SPEED = 175;
export const RUN_SPEED = 265;
export const PLAYER_R = 13;
export const PLAYER_HEALTH = 100;

// Cars
export const CAR_TYPES = {
  sedan: { len: 46, wid: 22, accel: 330, top: 380, grip: 3.4, color: '#c94f43' },
  taxi: { len: 46, wid: 22, accel: 330, top: 380, grip: 3.4, color: '#f2b705' },
  sports: { len: 48, wid: 22, accel: 460, top: 540, grip: 4.2, color: '#d7263d' },
  truck: { len: 62, wid: 26, accel: 240, top: 300, grip: 2.6, color: '#5b7fa6' },
  police: { len: 48, wid: 22, accel: 420, top: 470, grip: 4.0, color: '#222831' },
  van: { len: 54, wid: 24, accel: 280, top: 330, grip: 3.0, color: '#7a8b6f' },
};
export const CAR_HEALTH = 100;
export const TRAFFIC_SPEED = 120;
export const TRAFFIC_COUNT = 16;
export const PED_COUNT = 26;

// Wanted
export const WANTED_MAX = 5;
export const HEAT_PER_STAR = 20;
export const HEAT_DECAY = 1.4; // per second, only while quiet
export const CRIME_CAR_THEFT = 22;
export const CRIME_HIT_PED = 26;
export const CRIME_SHOOT = 18;
export const CRIME_KILL_COP = 30;

// Combat
export const PISTOL_DAMAGE = 34;
export const PISTOL_MAG = 12;
export const PISTOL_RANGE = 520;
export const BULLET_SPEED = 950;
export const RELOAD_TIME = 1.2;

// Palette: a sun-soaked coastal city at golden hour.
export const PAL = {
  grass: '#8fc97e', grassDark: '#7fb96f', sand: '#f2ddab', water: '#3fb8c9', waterDeep: '#2a9db0',
  road: '#4a4a52', roadEdge: '#3a3a42', sidewalk: '#b9b3a4', line: '#e8d44d',
  buildingRoof: ['#e8a87c', '#d9c9a3', '#a8c3d9', '#e58e8e', '#b5d3a7', '#d9b8d0', '#f0e0b8', '#9fb8c8'],
  park: '#6db36a', tree: '#3f7d3a', treeDark: '#2f6130',
  hudBg: 'rgba(12,14,20,0.72)', hudLine: 'rgba(255,255,255,0.16)',
  star: '#ffd23f', health: '#58d68d', healthLow: '#e74c3c', cash: '#7ee081',
  beacon: '#ffd23f', marker: '#ff5d8f', police: '#4aa3ff', player: '#ffcf3f',
};
