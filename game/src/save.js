// Save / load through localStorage: cash, mission progress, position, health.
import { SAVE_KEY } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      cash: G.player.cash, mission: G.missions.index,
      x: Math.round(G.player.x), y: Math.round(G.player.y),
      health: Math.round(G.player.health),
      completed: G.missions.index >= 5,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}
export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.cash !== 'number' || typeof d.mission !== 'number') return null;
    return d;
  } catch { return null; }
}
export function hasSave() { return loadGame() !== null; }
export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* private mode */ }
}
