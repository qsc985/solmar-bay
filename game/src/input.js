// Keyboard + mouse, read fresh every frame. Keys are tracked by code, so the
// player's keyboard layout doesn't matter.
//
// Edge-triggered presses are the subtle part. The world steps in fixed 1/60 s
// sub-steps, and a tap that lands between two sub-steps must not be swallowed
// by the first one: beginFrame snapshots whatever is pending when the frame
// starts, and endFrame clears only that snapshot, so a press that arrives
// mid-frame survives until the next frame.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_INTERACT = 'interact';
export const ACTION_RELOAD = 'reload';
export const ACTION_MUTE = 'mute';

const ACTION_KEYS = {
  confirm: ['Enter', 'Space'],
  pause: ['Escape', 'KeyP'],
  interact: ['KeyE'],
  reload: ['KeyR'],
  mute: ['KeyM'],
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered presses, consumed by takePressed
  let framePressed = new Set(); // presses pending when the frame began
  let frameClicked = false;
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  }
  function onMouseDown(e) {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  }
  function onMouseUp(e) {
    if (e.button === 0) mouse.down = false;
  }
  function onBlur() {
    keys.clear();
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    mouse,

    down(...codes) {
      return codes.some((c) => keys.has(c));
    },

    axis() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },

    run() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },

    // Consume one pending press for an action; true when it was there.
    takePressed(action) {
      for (const c of ACTION_KEYS[action] ?? []) {
        if (pressed.has(c)) {
          pressed.delete(c);
          return true;
        }
      }
      return false;
    },

    takeClick() {
      const c = mouse.clicked;
      mouse.clicked = false;
      return c;
    },

    beginFrame() {
      framePressed = new Set(pressed);
      frameClicked = mouse.clicked;
    },

    endFrame() {
      for (const c of framePressed) pressed.delete(c);
      if (frameClicked) mouse.clicked = false;
    },
  };
}
