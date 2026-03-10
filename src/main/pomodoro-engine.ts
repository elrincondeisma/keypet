import { EventEmitter } from 'events';
import {
  PomodoroPhase,
  PomodoroState,
  POMODORO_CYCLE_LENGTH,
} from '../shared/types';
import { startPomodoroSession, completePomodoroSession, getSettings } from './database';

// Events emitted by PomodoroEngine:
//   'tick'      — every second while active: (state: PomodoroState)
//   'complete'  — a work or break phase finished: (phase: PomodoroPhase)
//   'cancelled' — the user cancelled mid-session

class PomodoroEngine extends EventEmitter {
  private state: PomodoroState = {
    active: false,
    phase: 'work',
    paused: false,
    remainingSeconds: 25 * 60,
    completedPomodoros: 0,
  };

  private interval: ReturnType<typeof setInterval> | null = null;
  private currentSessionId: number | null = null;

  getState(): PomodoroState {
    return { ...this.state };
  }

  // Returns durations in seconds from current settings
  private _getDurations(): Record<PomodoroPhase, number> {
    const s = getSettings();
    return {
      'work':        s.pomodoroWork * 60,
      'short-break': s.pomodoroShortBreak * 60,
      'long-break':  s.pomodoroLongBreak * 60,
    };
  }

  start(): void {
    if (this.state.active) return;

    const durations = this._getDurations();
    this.state.active = true;
    this.state.phase = 'work';
    this.state.paused = false;
    this.state.remainingSeconds = durations['work'];
    this.state.completedPomodoros = 0;

    this.currentSessionId = startPomodoroSession('work');
    this._startTicking();
    this.emit('tick', this.getState());
  }

  pause(): void {
    if (!this.state.active || this.state.paused) return;
    this.state.paused = true;
    this._stopTicking();
    this.emit('tick', this.getState());
  }

  resume(): void {
    if (!this.state.active || !this.state.paused) return;
    this.state.paused = false;
    this._startTicking();
    this.emit('tick', this.getState());
  }

  skipBreak(): void {
    if (!this.state.active) return;
    if (this.state.phase === 'work') return; // can only skip breaks
    this._stopTicking();
    // Treat the break as completed so the cycle advances correctly
    if (this.currentSessionId !== null) {
      completePomodoroSession(this.currentSessionId);
    }
    this._beginWork();
  }

  cancel(): void {
    if (!this.state.active) return;
    this._stopTicking();
    this.state.active = false;
    this.state.paused = false;
    this.currentSessionId = null;
    this.emit('cancelled');
    this.emit('tick', this.getState());
  }

  // ---- private ----

  private _startTicking(): void {
    this.interval = setInterval(() => this._tick(), 1000);
  }

  private _stopTicking(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private _tick(): void {
    this.state.remainingSeconds -= 1;
    this.emit('tick', this.getState());

    if (this.state.remainingSeconds <= 0) {
      this._phaseComplete();
    }
  }

  private _phaseComplete(): void {
    this._stopTicking();
    const completedPhase = this.state.phase;

    if (this.currentSessionId !== null) {
      completePomodoroSession(this.currentSessionId);
      this.currentSessionId = null;
    }

    this.emit('complete', completedPhase);

    if (completedPhase === 'work') {
      this.state.completedPomodoros += 1;
      const isLongBreak = this.state.completedPomodoros % POMODORO_CYCLE_LENGTH === 0;
      this._beginBreak(isLongBreak ? 'long-break' : 'short-break');
    } else {
      // Break finished → start next work session automatically
      this._beginWork();
    }
  }

  private _beginWork(): void {
    const durations = this._getDurations();
    this.state.phase = 'work';
    this.state.paused = false;
    this.state.remainingSeconds = durations['work'];
    this.currentSessionId = startPomodoroSession('work');
    this._startTicking();
    this.emit('tick', this.getState());
  }

  private _beginBreak(phase: 'short-break' | 'long-break'): void {
    const durations = this._getDurations();
    this.state.phase = phase;
    this.state.paused = false;
    this.state.remainingSeconds = durations[phase];
    this.currentSessionId = startPomodoroSession(phase);
    this._startTicking();
    this.emit('tick', this.getState());
  }
}

export const pomodoroEngine = new PomodoroEngine();
