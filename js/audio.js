// js/audio.js
export class LabAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playTone(freq = 520, type = 'sine', duration = 0.08, volume = 0.1) {
    if (!this.enabled) return;
    this.init();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  playClick() {
    this.playTone(850, 'triangle', 0.04, 0.06);
  }

  playSelect() {
    this.playTone(960, 'sine', 0.1, 0.08);
  }

  playSuccess() {
    if (!this.enabled) return;
    this.init();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      setTimeout(() => this.playTone(f, 'sine', 0.12, 0.08), i * 80)
    );
  }

  playAlarm() {
    if (!this.enabled) return;
    this.init();
    this.playTone(420, 'sawtooth', 0.18, 0.09);
    setTimeout(() => this.playTone(560, 'sawtooth', 0.22, 0.09), 120);
  }
}