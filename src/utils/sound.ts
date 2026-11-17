class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(freq: number, duration: number, type: OscillatorType = 'square', gainVal = 0.04, delay = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playStep() {
    this.tone(180, 0.04, 'triangle', 0.02);
  }

  playChat() {
    this.tone(520, 0.06, 'sine', 0.03);
    this.tone(680, 0.07, 'sine', 0.025, 0.045);
  }

  playCoin() {
    this.tone(987.77, 0.08, 'square', 0.035);
    this.tone(1318.51, 0.16, 'square', 0.035, 0.07);
  }

  playQuest() {
    this.tone(523.25, 0.09, 'triangle', 0.05);
    this.tone(659.25, 0.09, 'triangle', 0.05, 0.08);
    this.tone(783.99, 0.09, 'triangle', 0.05, 0.16);
    this.tone(1046.5, 0.22, 'triangle', 0.06, 0.24);
  }

  playClick() {
    this.tone(440, 0.04, 'triangle', 0.025);
  }

  playHit() {
    this.tone(620, 0.08, 'square', 0.04);
  }

  playMiss() {
    this.tone(190, 0.16, 'sawtooth', 0.04);
  }
}

export const soundFX = new SoundEngine();
