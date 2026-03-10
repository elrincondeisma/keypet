import { uIOhook } from 'uiohook-napi';
import { EventEmitter } from 'events';

class KeyboardListener extends EventEmitter {
  private running = false;
  private recentKeys: number[] = [];
  private rateInterval: ReturnType<typeof setInterval> | null = null;
  private lastActivityTime = 0;
  private continuousActivityStart = 0;

  start(): void {
    if (this.running) return;
    this.running = true;

    uIOhook.on('keydown', () => {
      const now = Date.now();
      this.recentKeys.push(now);
      this.emit('keypress');

      if (now - this.lastActivityTime > 60000) {
        this.continuousActivityStart = now;
      }
      this.lastActivityTime = now;
    });

    uIOhook.start();

    // Calculate typing rate every 500ms
    this.rateInterval = setInterval(() => {
      const now = Date.now();
      // Keep only keys from the last 3 seconds
      this.recentKeys = this.recentKeys.filter((t) => now - t < 3000);
      const rate = this.recentKeys.length / 3;

      const timeSinceLastKey = now - this.lastActivityTime;
      const continuousMinutes = this.lastActivityTime > 0
        ? (this.lastActivityTime - this.continuousActivityStart) / 60000
        : 0;

      this.emit('rate', { rate, timeSinceLastKey, continuousMinutes });
    }, 500);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    uIOhook.stop();
    if (this.rateInterval) {
      clearInterval(this.rateInterval);
      this.rateInterval = null;
    }
  }
}

export const keyboardListener = new KeyboardListener();
