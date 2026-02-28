/** Web Audio API procedural sound engine */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this._bgmTimer = null;
    this._initialized = false;
  }

  async init() {
    if (this._initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.masterGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();

    this.masterGain.gain.value = 0.8;
    this.musicGain.gain.value = 0.5;
    this.sfxGain.gain.value = 0.9;

    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this._initialized = true;
    this._startBGM();
  }

  resume() {
    this.ctx?.state === 'suspended' && this.ctx.resume();
  }

  setMasterVolume(v) { if (this.masterGain) this.masterGain.gain.value = v; }
  setMusicVolume(v)  { if (this.musicGain)  this.musicGain.gain.value  = v; }
  setSFXVolume(v)    { if (this.sfxGain)    this.sfxGain.gain.value    = v; }

  // ─── Primitive tone ──────────────────────────────────────────────────────────
  _tone(freq, type = 'sine', duration = 0.2, vol = 0.3, dest = null) {
    if (!this.ctx) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(dest ?? this.sfxGain);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  _chord(freqs, type = 'sine', duration = 0.5, vol = 0.25) {
    freqs.forEach((f) => this._tone(f, type, duration, vol));
  }

  // ─── Sound events ─────────────────────────────────────────────────────────────
  playClick() {
    this._tone(700, 'square', 0.06, 0.18);
  }

  playDragLift() {
    this._tone(380, 'sine', 0.12, 0.2);
    setTimeout(() => this._tone(480, 'sine', 0.1, 0.12), 60);
  }

  playSnap() {
    this._tone(600, 'triangle', 0.08, 0.3);
    setTimeout(() => this._tone(900, 'triangle', 0.06, 0.15), 35);
  }

  playTileMark() {
    this._tone(523, 'sine', 0.18, 0.3);
    setTimeout(() => this._tone(659, 'sine', 0.14, 0.2), 55);
    setTimeout(() => this._tone(784, 'sine', 0.10, 0.15), 110);
  }

  playNumberReveal(number) {
    const base = 220 + (number % 12) * 18;
    this._tone(base,        'sine',     0.5,  0.45);
    setTimeout(() => this._tone(base * 1.26, 'sine', 0.35, 0.28), 90);
    setTimeout(() => this._tone(base * 1.5,  'sine', 0.25, 0.18), 200);
  }

  playCountdownTick() {
    this._tone(440, 'square', 0.08, 0.2);
  }

  playCountdownFinal() {
    this._chord([523, 659, 784, 1047], 'square', 0.4, 0.22);
  }

  playLineComplete() {
    const chord = [261, 329, 392, 523];
    chord.forEach((f, i) => setTimeout(() => this._tone(f, 'sine', 0.55, 0.28), i * 60));
  }

  playVictory() {
    const fanfare = [523, 659, 784, 1047, 784, 659, 1047, 1319];
    fanfare.forEach((f, i) => {
      setTimeout(() => {
        this._tone(f,       'sine',     0.45, 0.5);
        this._tone(f * 0.5, 'triangle', 0.45, 0.25);
      }, i * 160);
    });
  }

  playNearWin() {
    this._tone(880, 'sine', 0.15, 0.2);
    setTimeout(() => this._tone(1100, 'sine', 0.1, 0.12), 80);
  }

  /** Duck music during a dramatic moment */
  duckMusic(durationMs = 2000) {
    if (!this.musicGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    const cur = this.musicGain.gain.value;
    this.musicGain.gain.setTargetAtTime(cur * 0.15, now, 0.1);
    setTimeout(() => {
      if (this.musicGain)
        this.musicGain.gain.setTargetAtTime(cur, this.ctx.currentTime, 0.6);
    }, durationMs);
  }

  // ─── Procedural BGM ───────────────────────────────────────────────────────────
  _startBGM() {
    const pentatonic = [261, 293, 329, 392, 440, 523, 587, 659, 784, 880];
    let step = 0;

    const beat = () => {
      if (!this.ctx || this.ctx.state !== 'running') { step++; return; }
      const note = pentatonic[step % pentatonic.length];
      // Melody
      this._tone(note,       'sine',     0.25, 0.06, this.musicGain);
      // Harmony every 4 beats
      if (step % 4 === 0) {
        this._tone(note * 0.75, 'sine', 0.25, 0.04, this.musicGain);
      }
      step++;
    };

    this._bgmTimer = setInterval(beat, 450);
  }

  stopBGM() {
    clearInterval(this._bgmTimer);
    this._bgmTimer = null;
  }
}

export const audioEngine = new AudioEngine();
