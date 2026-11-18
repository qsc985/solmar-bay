// Particles, skid marks and floating text — the juice that makes impacts feel real.
export function createParticles() { return { list: [], skids: [], texts: [] }; }

export function puff(P, x, y, n, color, speed = 60, life = 0.6, size = 4) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
    P.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.7), max: life, size: size * (0.7 + Math.random() * 0.6), color });
  }
  if (P.list.length > 420) P.list.splice(0, P.list.length - 420);
}
export function skid(P, x, y, angle) {
  P.skids.push({ x, y, angle, life: 5 });
  if (P.skids.length > 240) P.skids.shift();
}
export function floatText(P, x, y, text, color = '#fff') {
  P.texts.push({ x, y, text, color, life: 1.4 });
  if (P.texts.length > 24) P.texts.shift();
}
export function updateParticles(P, dt) {
  for (let i = P.list.length - 1; i >= 0; i--) {
    const p = P.list[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt;
    if (p.life <= 0) P.list.splice(i, 1);
  }
  for (let i = P.skids.length - 1; i >= 0; i--) {
    P.skids[i].life -= dt;
    if (P.skids[i].life <= 0) P.skids.splice(i, 1);
  }
  for (let i = P.texts.length - 1; i >= 0; i--) {
    P.texts[i].y -= 26 * dt; P.texts[i].life -= dt;
    if (P.texts[i].life <= 0) P.texts.splice(i, 1);
  }
}
