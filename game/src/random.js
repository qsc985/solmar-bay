// Seeded randomness and the geometry helpers every system shares.
//
// The RNG is mulberry32: small, fast, and fully determined by its seed, so a
// `?seed=N` run stages the same city, traffic and pedestrians every time —
// which is what makes staged screenshots and playtests reproducible.
export function createRandom(seed) {
  let a = seed >>> 0;
  const rng = {
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    // Integer in [min, max], both ends included.
    int(min, max) {
      return min + Math.floor(rng.next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(rng.next() * list.length)];
    },
    range(min, max) {
      return min + rng.next() * (max - min);
    },
  };
  return rng;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Shortest signed turn from angle a toward angle b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
