import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { DailyStats, Settings, DEFAULT_SETTINGS, PomodoroPhase } from '../shared/types';

let db: Database.Database;

// Increment this constant whenever you add a new migration below.
const CURRENT_SCHEMA_VERSION = 2;

// Each migration runs exactly once, in order, on any DB that is behind.
// Rules:
//   - Never edit an existing migration — add a new one.
//   - Only use DDL that is safe to run on an older schema (ALTER TABLE … ADD COLUMN,
//     CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, etc.).
//   - Pure data back-fills are also fine inside a migration.
const MIGRATIONS: { version: number; sql: string[] }[] = [
  {
    // v0 → v1: baseline schema (daily_stats, evolution_history, meta + default settings)
    version: 1,
    sql: [
      `CREATE TABLE IF NOT EXISTS daily_stats (
        date TEXT PRIMARY KEY,
        total_keys INTEGER DEFAULT 0,
        hours TEXT DEFAULT '{}'
      )`,
      `CREATE TABLE IF NOT EXISTS evolution_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level INTEGER NOT NULL,
        reached_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      )`,
    ],
  },
  {
    // v1 → v2: Pomodoro session history
    version: 2,
    sql: [
      `CREATE TABLE IF NOT EXISTS pomodoro_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phase TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        completed INTEGER NOT NULL DEFAULT 0
      )`,
    ],
  },
  // Future migrations go here, e.g.:
  // {
  //   version: 3,
  //   sql: ["ALTER TABLE daily_stats ADD COLUMN mouse_clicks INTEGER DEFAULT 0"],
  // },
];

function getDbPath(): string {
  const dir = path.join(app.getPath('userData'));
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'keypet.db');
}

function getSchemaVersion(): number {
  // meta table may not exist yet on a brand-new DB
  const tableExists = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='meta'`)
    .get();
  if (!tableExists) return 0;

  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('db_version') as
    | { value: string }
    | undefined;
  return row ? parseInt(row.value, 10) : 0;
}

function setSchemaVersion(version: number): void {
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
    'db_version',
    String(version)
  );
}

function runMigrations(): void {
  const current = getSchemaVersion();
  if (current >= CURRENT_SCHEMA_VERSION) return;

  const pending = MIGRATIONS.filter((m) => m.version > current);

  for (const migration of pending) {
    db.transaction(() => {
      for (const sql of migration.sql) {
        db.exec(sql);
      }
      setSchemaVersion(migration.version);
    })();
  }
}

export function initDatabase(): void {
  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');

  runMigrations();

  // Initialize settings if not present
  const existing = db.prepare('SELECT value FROM meta WHERE key = ?').get('settings');
  if (!existing) {
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(
      'settings',
      JSON.stringify(DEFAULT_SETTINGS)
    );
  }
}

export function incrementKeyCount(): void {
  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();

  const row = db.prepare('SELECT total_keys, hours FROM daily_stats WHERE date = ?').get(today) as
    | { total_keys: number; hours: string }
    | undefined;

  if (row) {
    const hours: Record<string, number> = JSON.parse(row.hours);
    hours[hour] = (hours[hour] || 0) + 1;
    db.prepare('UPDATE daily_stats SET total_keys = total_keys + 1, hours = ? WHERE date = ?').run(
      JSON.stringify(hours),
      today
    );
  } else {
    const hours: Record<string, number> = { [hour]: 1 };
    db.prepare('INSERT INTO daily_stats (date, total_keys, hours) VALUES (?, 1, ?)').run(
      today,
      JSON.stringify(hours)
    );
  }
}

export function getDailyStats(date: string): DailyStats | null {
  const row = db.prepare('SELECT date, total_keys, hours FROM daily_stats WHERE date = ?').get(date) as
    | { date: string; total_keys: number; hours: string }
    | undefined;
  if (!row) return null;
  return { date: row.date, totalKeys: row.total_keys, hours: JSON.parse(row.hours) };
}

export function getStatsRange(startDate: string, endDate: string): DailyStats[] {
  const rows = db
    .prepare('SELECT date, total_keys, hours FROM daily_stats WHERE date >= ? AND date <= ? ORDER BY date')
    .all(startDate, endDate) as { date: string; total_keys: number; hours: string }[];
  return rows.map((r) => ({ date: r.date, totalKeys: r.total_keys, hours: JSON.parse(r.hours) }));
}

export function getTotalHistoric(): number {
  const row = db.prepare('SELECT COALESCE(SUM(total_keys), 0) as total FROM daily_stats').get() as {
    total: number;
  };
  return row.total;
}

export function getStreak(): number {
  const rows = db
    .prepare('SELECT date, total_keys FROM daily_stats WHERE total_keys >= 100 ORDER BY date DESC')
    .all() as { date: string; total_keys: number }[];

  if (rows.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if today or yesterday qualifies (streak can include today even if day isn't over)
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const dateSet = new Set(rows.map((r) => r.date));

  let checkDate: Date;
  if (dateSet.has(todayStr)) {
    checkDate = new Date(today);
  } else if (dateSet.has(yesterdayStr)) {
    checkDate = new Date(yesterday);
  } else {
    return 0;
  }

  while (dateSet.has(checkDate.toISOString().slice(0, 10))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

export function getSettings(): Settings {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('settings') as
    | { value: string }
    | undefined;
  if (!row) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
}

export function saveSettings(settings: Settings): void {
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
    'settings',
    JSON.stringify(settings)
  );
}

export function getEvolutionHistory(): { level: number; reached_at: string }[] {
  return db.prepare('SELECT level, reached_at FROM evolution_history ORDER BY level').all() as {
    level: number;
    reached_at: string;
  }[];
}

export function recordEvolution(level: number): void {
  const existing = db
    .prepare('SELECT id FROM evolution_history WHERE level = ?')
    .get(level);
  if (!existing) {
    db.prepare('INSERT INTO evolution_history (level, reached_at) VALUES (?, ?)').run(
      level,
      new Date().toISOString()
    );
  }
}

export function resetAll(): void {
  db.exec('DELETE FROM daily_stats; DELETE FROM evolution_history; DELETE FROM meta; DELETE FROM pomodoro_sessions;');
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(
    'settings',
    JSON.stringify(DEFAULT_SETTINGS)
  );
}

// --- Pomodoro ---

export function startPomodoroSession(phase: PomodoroPhase): number {
  const result = db
    .prepare('INSERT INTO pomodoro_sessions (phase, started_at, completed) VALUES (?, ?, 0)')
    .run(phase, new Date().toISOString());
  return result.lastInsertRowid as number;
}

export function completePomodoroSession(id: number): void {
  db.prepare('UPDATE pomodoro_sessions SET completed = 1, completed_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    id
  );
}

export function getPomodoroCountToday(): number {
  const today = new Date().toISOString().slice(0, 10);
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM pomodoro_sessions
       WHERE phase = 'work' AND completed = 1
       AND started_at >= ?`
    )
    .get(today + 'T00:00:00.000Z') as { count: number };
  return row.count;
}

export function closeDatabase(): void {
  if (db) db.close();
}
