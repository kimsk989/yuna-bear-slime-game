// Simple procedural background music using the Web Audio API.
// No external audio files — a short looping pentatonic melody over a soft pad.
export class BgMusic {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.enabled = true;
    this.playing = false;
    this.nextNoteTime = 0;
    this.noteIndex = 0;
    this.timerId = null;
    this.noteDuration = 0.42;
    // C major pentatonic, gentle up-and-down phrase
    this.notes = [261.63, 293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66];
  }

  ensureCtx() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.16;
    this.masterGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.ctx.destination);
  }

  resumeIfNeeded() {
    this.ensureCtx();
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  // short percussive "thwack" for a landed hit
  playHit() {
    this.resumeIfNeeded();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(480, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.09);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.13);

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.08);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 1000;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.22, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(t);
  }

  // cute rising-then-falling "poof" when a slime is defeated
  playDefeat() {
    this.resumeIfNeeded();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(760, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.3);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.34);
  }

  // short ascending jingle for level-up
  playLevelUp() {
    this.resumeIfNeeded();
    const t = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((f, i) => {
      const start = t + i * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.32, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  playNote(freq, time) {
    const dur = this.noteDuration;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.45, time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + dur + 0.02);

    // soft low pad note, an octave down
    const pad = this.ctx.createOscillator();
    const padGain = this.ctx.createGain();
    pad.type = "sine";
    pad.frequency.value = freq / 2;
    padGain.gain.setValueAtTime(0, time);
    padGain.gain.linearRampToValueAtTime(0.16, time + 0.06);
    padGain.gain.exponentialRampToValueAtTime(0.001, time + dur * 1.5);
    pad.connect(padGain);
    padGain.connect(this.masterGain);
    pad.start(time);
    pad.stop(time + dur * 1.5 + 0.02);
  }

  scheduler() {
    while (this.nextNoteTime < this.ctx.currentTime + 0.2) {
      this.playNote(this.notes[this.noteIndex % this.notes.length], this.nextNoteTime);
      this.nextNoteTime += this.noteDuration;
      this.noteIndex++;
    }
  }

  start() {
    if (!this.enabled) return;
    this.ensureCtx();
    if (this.ctx.state === "suspended") this.ctx.resume();
    if (this.playing) return;
    this.playing = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.timerId = setInterval(() => this.scheduler(), 100);
  }

  stop() {
    this.playing = false;
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = null;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) this.start();
    else this.stop();
    return this.enabled;
  }
}
