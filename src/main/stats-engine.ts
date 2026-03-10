import {
  getDailyStats,
  getStatsRange,
  getTotalHistoric,
  getStreak,
  getEvolutionHistory,
  recordEvolution,
} from './database';
import { StatsSnapshot, PetState, EVOLUTION_THRESHOLDS } from '../shared/types';

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sumKeys(startDate: string, endDate: string): number {
  const stats = getStatsRange(startDate, endDate);
  return stats.reduce((sum, s) => sum + s.totalKeys, 0);
}

export function getFullStats(): StatsSnapshot {
  const now = new Date();
  const today = formatDate(now);

  // Today
  const todayStats = getDailyStats(today);
  const todayCount = todayStats?.totalKeys || 0;

  // Yesterday comparison
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStats = getDailyStats(formatDate(yesterday));
  const yesterdayCount = yesterdayStats?.totalKeys || 0;
  const todayComparison = yesterdayCount > 0 ? ((todayCount - yesterdayCount) / yesterdayCount) * 100 : 0;

  // This week
  const monday = getMonday(new Date(now));
  const thisWeek = sumKeys(formatDate(monday), today);

  // Last week comparison
  const lastMonday = new Date(monday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastSunday = new Date(monday);
  lastSunday.setDate(lastSunday.getDate() - 1);
  const lastWeek = sumKeys(formatDate(lastMonday), formatDate(lastSunday));
  const weekComparison = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;

  // This month
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const thisMonth = sumKeys(monthStart, today);

  // Last month comparison
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonth = sumKeys(formatDate(lastMonthDate), formatDate(lastMonthEnd));
  const monthComparison = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  // Hourly today
  const hourlyToday = new Array(24).fill(0);
  if (todayStats) {
    for (const [h, count] of Object.entries(todayStats.hours)) {
      hourlyToday[parseInt(h)] = count;
    }
  }

  // Weekly days (last 7 days)
  const weeklyDays: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    const stats = getDailyStats(dateStr);
    weeklyDays.push({ date: dateStr, count: stats?.totalKeys || 0 });
  }

  const totalHistoric = getTotalHistoric();
  const streak = getStreak();

  // Evolution
  const evolutionLevel = calculateEvolutionLevel(totalHistoric, streak);

  return {
    today: todayCount,
    thisWeek,
    thisMonth,
    totalHistoric,
    streak,
    todayComparison,
    weekComparison,
    monthComparison,
    hourlyToday,
    weeklyDays,
    evolutionLevel,
    totalForEvolution: totalHistoric,
    streakForEvolution: streak,
  };
}

export function calculateEvolutionLevel(totalKeys: number, streak: number): number {
  let level = 1;
  for (const threshold of EVOLUTION_THRESHOLDS) {
    if (totalKeys >= threshold.keys && streak >= threshold.streak) {
      level = threshold.level;
    }
  }
  return level;
}

export function checkAndRecordEvolution(): { newLevel: number } | null {
  const totalKeys = getTotalHistoric();
  const streak = getStreak();
  const currentLevel = calculateEvolutionLevel(totalKeys, streak);

  const history = getEvolutionHistory();
  const recordedLevels = new Set(history.map((h) => h.level));

  if (currentLevel > 1 && !recordedLevels.has(currentLevel)) {
    recordEvolution(currentLevel);
    return { newLevel: currentLevel };
  }

  return null;
}

export function determinePetState(
  rate: number,
  timeSinceLastKey: number,
  continuousMinutes: number
): PetState {
  if (continuousMinutes > 120) return 'tired';
  if (timeSinceLastKey > 60000) return 'idle';
  if (rate > 5) return 'frenetic';
  if (rate > 0) return 'active';
  return 'idle';
}
