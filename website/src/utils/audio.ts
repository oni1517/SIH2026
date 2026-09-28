/**
 * Procedural synthesized industrial audio cues using Web Audio API
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public playTone(freq: number, type: OscillatorType, duration: number, gainValue = 0.08) {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // AudioContext policy suppression fallback
    }
  }

  public playClick() {
    this.playTone(850, 'sine', 0.04, 0.03);
  }

  public playWarning() {
    this.playTone(620, 'triangle', 0.16, 0.08);
    setTimeout(() => this.playTone(740, 'triangle', 0.22, 0.08), 120);
  }

  public playCritical() {
    this.playTone(950, 'sawtooth', 0.15, 0.1);
    setTimeout(() => this.playTone(1200, 'sawtooth', 0.25, 0.12), 140);
  }

  public playSuccess() {
    this.playTone(520, 'sine', 0.08, 0.05);
    setTimeout(() => this.playTone(780, 'sine', 0.14, 0.05), 90);
  }
}

export const sound = new SoundEngine();
