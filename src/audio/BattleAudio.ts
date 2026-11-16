import type {PokemonType} from '../pokemonData.ts';

/**
 * 100% procedural Web Audio API synthesizer inspired by classic Gen 1 Game Boy
 * battle chimes, menu blips, and 3D stadium impacts.
 */
export class BattleAudio {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private _muted = false;

  get muted(): boolean {
    return this._muted;
  }

  set muted(value: boolean) {
    this._muted = value;
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    if (!this._muted) {
      this.playMenuConfirm();
    }
    return this._muted;
  }

  private ensureContext(): AudioContext | null {
    if (this._muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as {webkitAudioContext?: typeof AudioContext})
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = ctx.sampleRate * 0.6;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private tone(
    ctx: AudioContext,
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'square',
    gainPeak = 0.08,
    delay = 0
  ): void {
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freqStart), start);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, freqEnd),
        start + duration
      );
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(gainPeak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private noiseBurst(
    ctx: AudioContext,
    duration: number,
    filterFreq: number,
    filterType: BiquadFilterType,
    gainPeak = 0.09,
    delay = 0
  ): void {
    const start = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(start);
    src.stop(start + duration + 0.02);
  }

  playMenuBlip(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.tone(ctx, 740, 880, 0.055, 'square', 0.05);
  }

  playMenuConfirm(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.tone(ctx, 587, 587, 0.06, 'square', 0.06, 0);
    this.tone(ctx, 880, 880, 0.09, 'square', 0.06, 0.05);
  }

  playPokeballRelease(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.tone(ctx, 320, 960, 0.18, 'triangle', 0.09, 0);
    this.noiseBurst(ctx, 0.22, 2200, 'bandpass', 0.07, 0.14);
    this.tone(ctx, 660, 1320, 0.16, 'square', 0.06, 0.18);
  }

  playMoveLaunch(type: PokemonType): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    switch (type) {
      case 'FIRE':
        this.noiseBurst(ctx, 0.45, 750, 'lowpass', 0.11, 0);
        this.tone(ctx, 220, 110, 0.38, 'sawtooth', 0.06, 0);
        break;
      case 'WATER':
      case 'ICE':
        this.noiseBurst(ctx, 0.42, 1600, 'bandpass', 0.1, 0);
        this.tone(ctx, 480, 260, 0.3, 'triangle', 0.06, 0.04);
        break;
      case 'ELECTRIC':
        for (let i = 0; i < 4; i++) {
          this.tone(
            ctx,
            1100 + (i % 2) * 520,
            680,
            0.07,
            'sawtooth',
            0.07,
            i * 0.07
          );
        }
        this.noiseBurst(ctx, 0.25, 3200, 'highpass', 0.06, 0.05);
        break;
      case 'GRASS':
        for (let i = 0; i < 3; i++) {
          this.tone(ctx, 980, 420, 0.09, 'triangle', 0.07, i * 0.09);
        }
        break;
      case 'GHOST':
      case 'PSYCHIC':
        this.tone(ctx, 420, 780, 0.2, 'sine', 0.08, 0);
        this.tone(ctx, 780, 310, 0.26, 'sine', 0.08, 0.18);
        break;
      default:
        this.tone(ctx, 260, 90, 0.22, 'sawtooth', 0.08, 0);
        this.noiseBurst(ctx, 0.15, 1100, 'lowpass', 0.08, 0.02);
        break;
    }
  }

  playHitImpact(effectiveness: number, critical: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (effectiveness >= 2) {
      // Iconic punchy Gen 1 super effective hit
      this.noiseBurst(ctx, 0.18, 1400, 'lowpass', 0.14, 0);
      this.tone(ctx, 520, 180, 0.14, 'square', 0.09, 0);
      this.tone(ctx, 780, 340, 0.18, 'square', 0.09, 0.09);
    } else if (effectiveness < 1 && effectiveness > 0) {
      // Dull not-very-effective thud
      this.tone(ctx, 160, 85, 0.14, 'triangle', 0.08, 0);
    } else {
      // Standard crunch
      this.noiseBurst(ctx, 0.14, 1100, 'lowpass', 0.11, 0);
      this.tone(ctx, 280, 110, 0.15, 'square', 0.08, 0);
    }

    if (critical) {
      this.tone(ctx, 1046, 1567, 0.12, 'square', 0.06, 0.12);
    }
  }

  playHeal(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, idx) => {
      this.tone(ctx, f, f, 0.11, 'triangle', 0.07, idx * 0.075);
    });
  }

  playFaint(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.tone(ctx, 440, 75, 0.55, 'sawtooth', 0.08, 0);
  }

  playVictoryFanfare(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const melody = [
      {f: 523, d: 0.12, t: 0},
      {f: 659, d: 0.12, t: 0.13},
      {f: 784, d: 0.12, t: 0.26},
      {f: 1046, d: 0.36, t: 0.39},
      {f: 784, d: 0.14, t: 0.78},
      {f: 1046, d: 0.48, t: 0.94},
    ];
    for (const note of melody) {
      this.tone(ctx, note.f, note.f, note.d, 'square', 0.07, note.t);
    }
  }
}
