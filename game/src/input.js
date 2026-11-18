// Keyboard + mouse + touch input. Keys are tracked by code; the mouse reports
// screen coordinates and a held state. Edge-triggered "pressed" flags are consumed
// once per frame by the game loop.

import { KEYS } from './config.js';

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
    touch: { active: false, dx: 0, dy: 0 },
    axis() {
      let x = 0;
      let y = 0;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    run() {
      return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    },
    wasPressed(code) {
      return this.pressed.has(code);
    },
    endFrame() {
      this.pressed.clear();
      this.mouse.clicked = false;
    },
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());

  const setMouse = (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
  };
  canvas.addEventListener('mousemove', setMouse);
  canvas.addEventListener('mousedown', (e) => {
    setMouse(e);
    input.mouse.down = true;
    input.mouse.clicked = true;
  });
  window.addEventListener('mouseup', () => { input.mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Minimal touch: left half is a virtual stick, right half aims/shoots.
  let stickId = null;
  let stickOrigin = null;
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const r = canvas.getBoundingClientRect();
      const x = t.clientX - r.left;
      const y = t.clientY - r.top;
      if (x < r.width / 2 && stickId === null) {
        stickId = t.identifier;
        stickOrigin = { x, y };
      } else {
        input.mouse.x = x;
        input.mouse.y = y;
        input.mouse.down = true;
        input.mouse.clicked = true;
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const r = canvas.getBoundingClientRect();
      if (t.identifier === stickId && stickOrigin) {
        input.touch.active = true;
        input.touch.dx = (t.clientX - r.left - stickOrigin.x) / 50;
        input.touch.dy = (t.clientY - r.top - stickOrigin.y) / 50;
      } else {
        input.mouse.x = t.clientX - r.left;
        input.mouse.y = t.clientY - r.top;
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        stickId = null;
        stickOrigin = null;
        input.touch.active = false;
        input.touch.dx = 0;
        input.touch.dy = 0;
      }
    }
    input.mouse.down = false;
  });

  return input;
}

export { KEYS };
