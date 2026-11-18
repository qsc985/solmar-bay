// All sound is synthesized with WebAudio — no audio files, nothing fetched.
// The context is created lazily on the first user gesture (browsers block
// audio before one), and every effect is a short oscillator or noise burst.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let muted = false;
  let musicOn = true;
  const state = { siren: 0, engine: 0 };

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // A low sawtooth hum whose pitch follows the driven car's speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filt);
      filt.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch {
      return false;
    }
    return true;
  }

  function blip(freq, dur, type = 'sine', vol = 0.2, slideTo = 0) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.25, freq = 1200) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  // A lazy two-bar bassline, scheduled a note at a time so it costs nothing.
  const BASS = [55, 0, 55, 65.4, 55, 0, 49, 58.3, 55, 0, 55, 65.4, 82.4, 73.4, 65.4, 49];
  let step = 0;
  function musicTick() {
    if (!ctx || muted || !musicOn) return;
    const f = BASS[step % BASS.length];
    step++;
    if (f) blip(f, 0.22, 'triangle', 0.07);
    if (step % 8 === 0) blip(220, 0.3, 'sine', 0.03);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    toggleMusic() {
      musicOn = !musicOn;
      return musicOn;
    },
    startMusic() {
      if (!musicTimer) musicTimer = setInterval(musicTick, 240);
    },
    shoot() {
      noise(0.09, 0.3, 2400);
    },
    hit() {
      blip(180, 0.08, 'square', 0.12, 90);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.18);
      blip(990, 0.14, 'sine', 0.16);
    },
    cash() {
      blip(880, 0.08, 'sine', 0.16);
      setTimeout(() => blip(1174, 0.12, 'sine', 0.16), 70);
    },
    mission() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.18), i * 90));
    },
    crash() {
      noise(0.25, 0.35, 500);
    },
    siren(on) {
      state.siren = on ? 1 : 0;
    },
    engine(level) {
      state.engine = level;
    },
    update() {
      if (!ctx || muted) return;
      if (engineGain) {
        engineGain.gain.value = state.engine * 0.05;
        engineOsc.frequency.value = 45 + state.engine * 130;
      }
    },
  };
}
