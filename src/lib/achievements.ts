import type { StudyLog } from './study';
import type { Assignment } from './assignments';

/** ローカル日付キー 'yyyy-m-d'。 */
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/**
 * 連続勉強日数。今日まだ勉強していなくても、昨日まで続いていれば
 * 「継続中」とみなして昨日から数える。
 */
export function calcStreak(logs: StudyLog[]): number {
  const days = new Set(logs.map((l) => dayKey(new Date(l.startedAt))));
  if (days.size === 0) return 0;
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export type Badge = {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  earned: boolean;
};

/** 勉強記録と提出物から獲得バッジを算出する。 */
export function calcBadges(logs: StudyLog[], assignments: Assignment[]): Badge[] {
  const totalSec = logs.reduce((s, l) => s + l.durationSec, 0);
  const streak = calcStreak(logs);
  const doneCount = assignments.filter((a) => a.done).length;

  // 1日の最大勉強時間（秒）
  const byDay = new Map<string, number>();
  for (const l of logs) {
    const k = dayKey(new Date(l.startedAt));
    byDay.set(k, (byDay.get(k) ?? 0) + l.durationSec);
  }
  const maxDaySec = Math.max(0, ...byDay.values());

  return [
    { id: 'first', emoji: '🐣', name: 'はじめの一歩', desc: '初めて勉強を記録した', earned: logs.length > 0 },
    { id: 'streak3', emoji: '🔥', name: '3日連続', desc: '3日連続で勉強した', earned: streak >= 3 },
    { id: 'streak7', emoji: '🚀', name: '1週間連続', desc: '7日連続で勉強した', earned: streak >= 7 },
    { id: 'streak30', emoji: '👑', name: '1ヶ月連続', desc: '30日連続で勉強した', earned: streak >= 30 },
    { id: 'total10h', emoji: '⏰', name: '合計10時間', desc: '累計10時間勉強した', earned: totalSec >= 10 * 3600 },
    { id: 'total50h', emoji: '💪', name: '合計50時間', desc: '累計50時間勉強した', earned: totalSec >= 50 * 3600 },
    { id: 'total100h', emoji: '🏆', name: '合計100時間', desc: '累計100時間勉強した', earned: totalSec >= 100 * 3600 },
    { id: 'day3h', emoji: '🌙', name: '集中デー', desc: '1日で3時間以上勉強した', earned: maxDaySec >= 3 * 3600 },
    { id: 'done10', emoji: '✅', name: '提出マスター', desc: '提出物を10件完了した', earned: doneCount >= 10 },
  ];
}
