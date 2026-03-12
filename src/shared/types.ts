export interface DailyStats {
  date: string;
  totalKeys: number;
  hours: Record<number, number>;
}

export interface StatsSnapshot {
  today: number;
  thisWeek: number;
  thisMonth: number;
  totalHistoric: number;
  streak: number;
  todayComparison: number;
  weekComparison: number;
  monthComparison: number;
  hourlyToday: number[];
  weeklyDays: { date: string; count: number }[];
  evolutionLevel: number;
  totalForEvolution: number;
  streakForEvolution: number;
}

export type PetState = 'idle' | 'active' | 'frenetic' | 'tired' | 'sad' | 'celebration';

export type PetCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type PetSize = 'xxsmall' | 'xsmall' | 'small' | 'normal' | 'large';

export type PetCharacter = 'chico' | 'chica';

export type NotificationLevel = 'all' | 'evolution' | 'none';

export interface Settings {
  corner: PetCorner;
  size: PetSize;
  character: PetCharacter;
  autoStart: boolean;
  notifications: NotificationLevel;
  workHoursStart: number;
  workHoursEnd: number;
  petVisible: boolean;
  pomodoroWork: number;       // minutes
  pomodoroShortBreak: number; // minutes
  pomodoroLongBreak: number;  // minutes
}

export const DEFAULT_SETTINGS: Settings = {
  corner: 'bottom-right',
  size: 'normal',
  character: 'chico',
  autoStart: false,
  notifications: 'all',
  workHoursStart: 9,
  workHoursEnd: 18,
  petVisible: true,
  pomodoroWork: 25,
  pomodoroShortBreak: 5,
  pomodoroLongBreak: 15,
};

export const EVOLUTION_THRESHOLDS = [
  { level: 1, keys: 0, streak: 0 },
  { level: 2, keys: 50000, streak: 7 },
  { level: 3, keys: 200000, streak: 14 },
  { level: 4, keys: 500000, streak: 30 },
  { level: 5, keys: 1000000, streak: 60 },
];

export interface PetDimensions {
  w: number;
  h: number;
}

// --- Pomodoro ---

export type PomodoroPhase = 'work' | 'short-break' | 'long-break';

export interface PomodoroState {
  active: boolean;
  phase: PomodoroPhase;
  paused: boolean;
  remainingSeconds: number;
  completedPomodoros: number; // within current cycle (resets every 4)
}

export const POMODORO_DURATIONS: Record<PomodoroPhase, number> = {
  'work':        25 * 60,
  'short-break':  5 * 60,
  'long-break':  15 * 60,
};

// How many work sessions before a long break
export const POMODORO_CYCLE_LENGTH = 4;

// Minimum BrowserWindow size to avoid Chromium/Electron bug where transparent
// windows become opaque below ~64 px on macOS (electron/electron#38630).
// 128x160 stays safe even on displays with scaleFactor differences.
export const MIN_WINDOW = { w: 128, h: 160 };

// Widths chosen per size; height derived from the ~4:5 GIF aspect ratio.
export const SIZE_MAP: Record<PetSize, PetDimensions> = {
  xxsmall: { w: 48, h: 60  },
  xsmall:  { w: 64, h: 80  },
  small:  { w: 96,  h: 120 },
  normal: { w: 128, h: 160 },
  large:  { w: 192, h: 240 },
};
