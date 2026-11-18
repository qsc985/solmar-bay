// Keyboard + mouse, read fresh every frame. Keys are tracked by code so layouts don't matter.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_INTERACT = 'interact';
export const ACTION_RELOAD = 'reload';
export const ACTION_MUTE = 'mute';

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered: consumed by takePressed
  // Keys/clicks that were already pending when the frame began. endFrame clears
  // only those: a press that lands mid-frame (between sub-steps) survives until
  // the next frame, so a brief key tap can never be eaten by a sub-step.
  let stalePressed = new Set();
  let staleClicked = false;
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const codeOf = (e) => e.code;

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  }
  function onMouseDown(e) { if (e.button === 0) { mouse.down = true; mouse.clicked = true; } }
  function onMouseUp(e) { if (e.button === 0) mouse.down = false; }
  function onBlur() { keys.clear(); mouse.down = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    mouse,
    down(...codes) { return codes.some((c) => keys.has(c)); },
    axis() {
      let x = 0, y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    takePressed(action) {
      const map = {
        confirm: ['Enter', 'Space'],
        pause: ['Escape', 'KeyP'],
        interact: ['KeyE'],
        reload: ['KeyR'],
        mute: ['KeyM'],
      };
      for (const c of map[action] ?? []) {
        if (pressed.has(c)) { pressed.delete(c); return true; }
      }
      return false;
    },
    takeClick() { const c = mouse.clicked; mouse.clicked = false; return c; },
    beginFrame() { stalePressed = new Set(pressed); staleClicked = mouse.clicked; },
    endFrame() {
      for (const c of stalePressed) pressed.delete(c);
      if (staleClicked) mouse.clicked = false;
    },
  };
}
