// AudioManager.js - Web Audio API 音效系统
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.enabled = false;
    this.musicTimer = null;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.3;
      this.musicGain.connect(this.masterGain);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.6;
      this.sfxGain.connect(this.masterGain);
      this.enabled = true;
    } catch (e) {
      console.warn('Audio init failed:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // 通用音调播放
  _tone(freq, dur, type = 'sine', vol = 0.3, attack = 0.01, release = 0.1) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.linearRampToValueAtTime(0, t + dur + release);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + release + 0.05);
  }

  // 音调滑动
  _slide(freqStart, freqEnd, dur, type = 'sine', vol = 0.3) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // 噪音
  _noise(dur, vol = 0.15, filterFreq = 1000) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + dur + 0.05);
  }

  // === 游戏音效 ===
  pedal() { this._tone(220 + Math.random() * 40, 0.08, 'square', 0.08, 0.005, 0.03); }
  brake() { this._noise(0.25, 0.08, 800); }
  jump() { this._slide(300, 700, 0.3, 'triangle', 0.2); }
  land() { this._noise(0.15, 0.12, 400); this._tone(100, 0.1, 'sine', 0.1); }
  trick() { this._tone(880, 0.1, 'triangle', 0.2); this._tone(1320, 0.15, 'triangle', 0.15); }
  checkpoint() { this._tone(660, 0.1, 'sine', 0.2); this._tone(880, 0.15, 'sine', 0.2); }
  crash() { this._slide(400, 80, 0.5, 'sawtooth', 0.15); this._noise(0.3, 0.1, 500); }
  finish() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => setTimeout(() => this._tone(n, 0.15, 'triangle', 0.25), i * 150));
  }
  countdownBeep() { this._tone(440, 0.15, 'sine', 0.3); }
  countdownGo() { this._tone(880, 0.3, 'triangle', 0.35); }
  selectClick() { this._tone(600, 0.05, 'square', 0.12); }

  // === 背景音乐 (简单旋律循环) ===
  startMusic() {
    if (!this.enabled || this.musicTimer) return;
    // 轻快治愈旋律 - C大调
    const melody = [
      { n: 523, d: 0.3 }, { n: 659, d: 0.3 }, { n: 784, d: 0.3 }, { n: 659, d: 0.3 },
      { n: 523, d: 0.3 }, { n: 587, d: 0.3 }, { n: 659, d: 0.6 },
      { n: 440, d: 0.3 }, { n: 523, d: 0.3 }, { n: 659, d: 0.3 }, { n: 523, d: 0.3 },
      { n: 440, d: 0.3 }, { n: 392, d: 0.3 }, { n: 523, d: 0.6 },
    ];
    const bassLine = [261, 261, 196, 196];
    let idx = 0;
    const playNext = () => {
      if (!this.enabled || !this.musicTimer) return;
      const note = melody[idx % melody.length];
      this._musicNote(note.n, note.d);
      if (idx % 4 === 0) {
        const bass = bassLine[(idx / 4 | 0) % bassLine.length];
        this._musicBass(bass, 1.2);
      }
      idx++;
      this.musicTimer = setTimeout(playNext, note.d * 1000);
    };
    playNext();
  }

  _musicNote(freq, dur) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.9);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + dur);
  }

  _musicBass(freq, dur) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.9);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + dur);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  setMusicVolume(v) {
    if (this.musicGain) this.musicGain.gain.value = v;
  }

  setSfxVolume(v) {
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }
}
