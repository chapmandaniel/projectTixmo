export class Pace {
  private nextAt = 0;

  constructor(
    private readonly intervalMs: number,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      })
  ) {}

  async wait(): Promise<void> {
    if (this.intervalMs <= 0) return;
    const now = Date.now();
    const delay = Math.max(0, this.nextAt - now);
    this.nextAt = Math.max(this.nextAt, now) + this.intervalMs;
    if (delay > 0) await this.sleep(delay);
  }
}
