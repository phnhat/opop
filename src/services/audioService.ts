class AudioService {
  private ctx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientNoise: AudioBufferSourceNode | null = null;
  private isAmbientPlaying = false;

  private rainGain: GainNode | null = null;
  private rainNoise: AudioBufferSourceNode | null = null;
  private isRainPlaying = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Play a cute synthesized toad ribbit/croak
  public playCroak(pitch: number = 1.0) {
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      const baseFreq = 120 * pitch;

      // Frequency bend for ribbit chirp
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 0.2);

      // Low pass filter for warm organic toad sound
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  // Play pop sound when chat bubble appears
  public playBubblePop() {
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.07);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  // Play splash sound when toad drops on lily pad
  public playSplash() {
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.Q.setValueAtTime(1.5, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start(now);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  // Play timer complete chime
  public playChime() {
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);

        gain.gain.setValueAtTime(0.1, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.8);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.85);
      });
    } catch (e) {
      console.warn('Chime playback error:', e);
    }
  }

  // Toggle ambient water flow sounds
  public toggleAmbient(enable: boolean, volume = 0.2) {
    this.initCtx();
    if (!this.ctx) return;

    if (!enable) {
      if (this.ambientGain) {
        const now = this.ctx.currentTime;
        this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now);
        this.ambientGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      }
      this.isAmbientPlaying = false;
      return;
    }

    if (this.isAmbientPlaying) return;

    try {
      const now = this.ctx.currentTime;
      // Synthesize soft water trickle noise
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.1;
      }

      this.ambientNoise = this.ctx.createBufferSource();
      this.ambientNoise.buffer = buffer;
      this.ambientNoise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, now);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.001, now);
      this.ambientGain.gain.linearRampToValueAtTime(volume, now + 1);

      this.ambientNoise.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);

      this.ambientNoise.start(now);
      this.isAmbientPlaying = true;
    } catch (e) {
      console.warn('Ambient water sound error:', e);
    }
  }

  // Soft rain pitter-patter sound synthesis
  public updateRainSound(intensity: number, enable: boolean = true) {
    this.initCtx();
    if (!this.ctx) return;

    const targetVol = enable ? intensity * 0.15 : 0.0;

    if (targetVol <= 0.001) {
      if (this.rainGain) {
        const now = this.ctx.currentTime;
        this.rainGain.gain.linearRampToValueAtTime(0.0001, now + 0.5);
      }
      return;
    }

    if (!this.isRainPlaying) {
      try {
        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.15;
        }

        this.rainNoise = this.ctx.createBufferSource();
        this.rainNoise.buffer = buffer;
        this.rainNoise.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.Q.setValueAtTime(0.8, now);

        this.rainGain = this.ctx.createGain();
        this.rainGain.gain.setValueAtTime(0.001, now);
        this.rainGain.gain.linearRampToValueAtTime(targetVol, now + 0.5);

        this.rainNoise.connect(filter);
        filter.connect(this.rainGain);
        this.rainGain.connect(this.ctx.destination);

        this.rainNoise.start(now);
        this.isRainPlaying = true;
      } catch (e) {
        console.warn('Rain sound error:', e);
      }
    } else if (this.rainGain) {
      const now = this.ctx.currentTime;
      this.rainGain.gain.linearRampToValueAtTime(targetVol, now + 0.3);
    }
  }

  // Play satisfying bomb explosion sound (punchy bass blast + sizzle)
  public playExplosion() {
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;

      // 1. Low sub-bass drop punch
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

      oscGain.gain.setValueAtTime(0.35, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);

      // 2. White noise explosion blast with resonant lowpass filter
      const bufferSize = this.ctx.sampleRate * 0.6;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.55);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noiseSource.start(now);
    } catch (e) {
      console.warn('Explosion sound error:', e);
    }
  }

  // Play fast energetic tongue push sound (whoosh whip + slap)
  public playTonguePush() {
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;

      // 1. Fast whip whoosh frequency sweep
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(750, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);

      // 2. Punchy impact slap at peak
      const slapOsc = this.ctx.createOscillator();
      const slapGain = this.ctx.createGain();
      slapOsc.type = 'triangle';
      slapOsc.frequency.setValueAtTime(320, now + 0.05);
      slapOsc.frequency.exponentialRampToValueAtTime(80, now + 0.12);

      slapGain.gain.setValueAtTime(0.001, now);
      slapGain.gain.setValueAtTime(0.2, now + 0.05);
      slapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      slapOsc.connect(slapGain);
      slapGain.connect(this.ctx.destination);

      slapOsc.start(now + 0.05);
      slapOsc.stop(now + 0.18);
    } catch (e) {
      console.warn('Tongue push sound error:', e);
    }
  }
}

export const audioService = new AudioService();
