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
