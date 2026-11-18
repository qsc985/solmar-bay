// Particles and floating text: muzzle flashes, sparks, smoke, blood, cash popups.
// Cheap circles and short-lived text; nothing here affects gameplay.

export function createParticles() {
  return { list: [], floats: [] };
}

export function addParticles(G, x, y, kind, n = 6) {
  const colors = {
    muzzle: ['#ffd23f', '#ff9f1c', '#fff3b0'],
    spark: ['#ffd23f', '#ffffff', '#ff9f1c'],
    smoke: ['#666666', '#888888', '#444444'],
    blood: ['#c1121f', '#8e2f32', '#6d1a1a'],
  };
  const palette = colors[kind] ?? ['#ffffff'];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = kind === 'smoke' ? 12 + Math.random() * 20 : 40 + Math.random() * 130;
    G.particles.list.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.35 + Math.random() * 0.45,
      max: 0.8,
      size: kind === 'smoke' ? 7 + Math.random() * 7 : 2 + Math.random() * 3,
      color: palette[Math.floor(Math.random() * palette.length)],
    });
  }
}

export function addFloat(G, x, y, text, color = '#ffffff') {
  G.particles.floats.push({ x, y, text, color, life: 1.4 });
}

export function updateParticles(G, dt) {
  for (const p of G.particles.list) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }
  G.particles.list = G.particles.list.filter((p) => p.life > 0);
  for (const f of G.particles.floats) {
    f.life -= dt;
    f.y -= 28 * dt;
  }
  G.particles.floats = G.particles.floats.filter((f) => f.life > 0);
}
