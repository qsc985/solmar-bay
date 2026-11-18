// Synthesised sound: WebAudio oscillators and noise, no audio files.
// Everything is guarded so a missing AudioContext (headless test) never throws.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    musicTimer: null,
    musicStep: 0,
    ensure() {
      if (this.ctx) return true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        // Engine hum: a low sawtooth whose pitch follows the car's speed.
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 320;
        this.engineOsc.connect(filt);
        filt.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
        return true;
      } catch {
        return false;
      }
    },
    setEngine(speed, maxSpeed) {
      if (!this.ctx || !this.engineOsc) return;
      const t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(50 + 130 * Math.abs(speed) / Math.max(1, maxSpeed), t, 0.08);
      this.engineGain.gain.setTargetAtTime(Math.abs(speed) > 5 ? 0.045 : 0, t, 0.1);
    },
    blip(freq, dur, type = 'sine', vol = 0.2, slideTo = null) {
      if (!this.ensure()) return;
      try {
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g);
        g.connect(this.master);
        o.start(t);
        o.stop(t + dur + 0.02);
      } catch { /* ignore */ }
    },
    noise(dur, vol = 0.25, lowpass = 1200) {
      if (!this.ensure()) return;
      try {
        const t = this.ctx.currentTime;
        const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = lowpass;
        const g = this.ctx.createGain();
        g.gain.value = vol;
        src.connect(filt);
        filt.connect(g);
        g.connect(this.master);
        src.start(t);
      } catch { /* ignore */ }
    },
    shoot() { this.noise(0.12, 0.3, 2400); this.blip(180, 0.08, 'square', 0.12, 60); },
    pickup() { this.blip(660, 0.12, 'sine', 0.22); setTimeout(() => this.blip(990, 0.16, 'sine', 0.22), 90); },
    crash() { this.noise(0.25, 0.35, 700); },
    siren() { this.blip(780, 0.28, 'triangle', 0.1, 980); },
    startMusic() {
      if (!this.ensure() || this.musicTimer) return;
      // A lazy bass line: A minor roots, one note a beat, 100 BPM.
      const roots = [55, 55, 65.4, 49];
      this.musicTimer = setInterval(() => {
        if (this.muted) return;
        const f = roots[this.musicStep % roots.length];
        this.musicStep++;
        this.blip(f, 0.5, 'triangle', 0.09);
        this.blip(f * 2, 0.3, 'sine', 0.05);
      }, 600);
    },
    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
      return this.muted;
    },
  };
  return audio;
}
