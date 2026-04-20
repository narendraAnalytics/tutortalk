export class AudioQueue {
  private nextStart = 0;
  private active: AudioBufferSourceNode[] = [];

  constructor(private ctx: AudioContext) {}

  push(buffer: AudioBuffer): void {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    // Schedule precisely after the previous buffer ends — gapless playback
    const t = Math.max(this.ctx.currentTime, this.nextStart);
    src.start(t);
    this.nextStart = t + buffer.duration;
    this.active.push(src);
    src.onended = () => {
      const i = this.active.indexOf(src);
      if (i !== -1) this.active.splice(i, 1);
    };
  }

  // Stop all buffered audio immediately — called on barge-in
  flush(): void {
    this.active.forEach(s => { try { s.stop(); } catch {} });
    this.active = [];
    this.nextStart = this.ctx.currentTime;
  }
}
