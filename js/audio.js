class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.noiseBuffer = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      this.ctx = new AudioCtx();
      const length = Math.floor(this.ctx.sampleRate * 0.6);
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (!this.muted) this.unlock();
  }

  toggle() {
    this.setMuted(!this.muted);
    if (!this.muted) this.click();
    return this.muted;
  }

  tone({ freq = 440, endFreq = null, duration = 0.08, type = 'square', volume = 0.025, delay = 0, attack = 0.004 } = {}) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  noise({ duration = 0.12, volume = 0.03, frequency = 1200, delay = 0, q = 0.7 } = {}) {
    if (this.muted || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(now);
    source.stop(now + duration);
  }

  click() {
    this.tone({ freq: 620, endFreq: 410, duration: 0.035, type: 'square', volume: 0.018 });
  }

  key() {
    this.tone({ freq: 290, endFreq: 220, duration: 0.035, type: 'triangle', volume: 0.022 });
  }

  hover() {
    this.tone({ freq: 820, duration: 0.02, type: 'sine', volume: 0.009 });
  }

  tick(urgent = false) {
    this.tone({
      freq: urgent ? 880 : 540,
      endFreq: urgent ? 680 : 480,
      duration: 0.055,
      type: 'square',
      volume: urgent ? 0.026 : 0.015,
    });
  }

  stageStart() {
    this.tone({ freq: 180, endFreq: 360, duration: 0.18, type: 'sawtooth', volume: 0.018 });
    this.tone({ freq: 360, endFreq: 720, duration: 0.14, type: 'square', volume: 0.012, delay: 0.12 });
  }

  capture() {
    this.noise({ duration: 0.07, volume: 0.035, frequency: 2100 });
    this.tone({ freq: 1100, endFreq: 1650, duration: 0.07, type: 'sine', volume: 0.02 });
  }

  correct() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
      this.tone({ freq, duration: 0.11, type: 'triangle', volume: 0.022, delay: index * 0.075 });
    });
  }

  match() {
    this.tone({ freq: 740, endFreq: 1180, duration: 0.12, type: 'square', volume: 0.018 });
    this.tone({ freq: 1480, duration: 0.07, type: 'sine', volume: 0.012, delay: 0.07 });
  }

  wrong() {
    this.tone({ freq: 180, endFreq: 92, duration: 0.16, type: 'sawtooth', volume: 0.03 });
    this.noise({ duration: 0.13, volume: 0.022, frequency: 520 });
  }

  strike() {
    this.wrong();
    this.tone({ freq: 440, endFreq: 210, duration: 0.28, type: 'square', volume: 0.018, delay: 0.08 });
  }

  glitch() {
    this.noise({ duration: 0.25, volume: 0.045, frequency: 1800, q: 0.3 });
    this.tone({ freq: 110, endFreq: 70, duration: 0.22, type: 'sawtooth', volume: 0.02 });
  }

  cutscene() {
    this.tone({ freq: 330, endFreq: 440, duration: 0.4, type: 'sine', volume: 0.017 });
    this.tone({ freq: 660, duration: 0.25, type: 'triangle', volume: 0.01, delay: 0.18 });
  }

  gameover() {
    this.glitch();
    [392, 311.13, 246.94, 196].forEach((freq, index) => {
      this.tone({ freq, duration: 0.24, type: 'sawtooth', volume: 0.018, delay: 0.15 + index * 0.16 });
    });
  }

  victory() {
    this.correct();
    [261.63, 329.63, 392, 523.25, 659.25].forEach((freq, index) => {
      this.tone({ freq, duration: 0.35, type: 'triangle', volume: 0.017, delay: 0.32 + index * 0.1 });
    });
  }
}

export const sound = new SoundEngine();
