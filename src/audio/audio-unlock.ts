export class AudioUnlock {
  private unlocked = false;

  /**
   * Unlock audio on iOS by creating and resuming an AudioContext
   * within a user gesture. This must be called from a user-initiated event.
   */
  async unlock(): Promise<void> {
    if (this.unlocked) return;

    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Play a silent buffer to fully unlock the audio system
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

      // Store globally so the game can reuse this context
      (window as any).__unlockedAudioContext = ctx;
      this.unlocked = true;
    } catch (e) {
      console.warn('Audio unlock failed:', e);
    }
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }
}
