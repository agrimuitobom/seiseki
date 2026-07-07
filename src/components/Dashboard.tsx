import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { GradePoint } from './GradeChart';
import { CareerAdvice } from './CareerAdvice';
import GradeForm from './GradeForm';
import { useAuth } from '../lib/auth';
import { useProfile, SCHOOL_LABELS } from '../lib/profile';
import { watchResults, removeResult, type TestResult } from '../lib/grades';

// recharts を含むチャートは遅延読み込み（初回ロードを軽量化）
const GradeChart = lazy(() => import('./GradeChart').then((m) => ({ default: m.GradeChart })));
const SubjectRadar = lazy(() => import('./SubjectRadar').then((m) => ({ default: m.SubjectRadar })));
const AllSubjectsChart = lazy(() =>
  import('./AllSubjectsChart').then((m) => ({ default: m.AllSubjectsChart })),
);

const ChartSkeleton = () => (
  <div className="h-52 w-full animate-pulse rounded-[12px] bg-sky-50" />
);
import { watchStudyLogs, sumDurationSince, startOfWeek, type StudyLog } from '../lib/study';
import { watchAssignments, setAssignmentDone, daysUntil, type Assignment } from '../lib/assignments';
import { calcStreak, calcBadges } from '../lib/achievements';
import { subjectColor, deepen } from '../lib/colors';

const pct = (score: number, max: number) => (max > 0 ? Math.round((score / max) * 100) : 0);

/** 時間帯に合わせたあいさつ。 */
const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'おつかれさま';
  if (h < 11) return 'おはよう';
  if (h < 18) return 'こんにちは';
  return 'こんばんは';
};

function StatCard({
  label,
  value,
  unit,
  tone = 'main',
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'main' | 'accent' | 'success';
}) {
  const toneText = { main: 'text-main', accent: 'text-accent', success: 'text-success' }[tone];
  return (
    <div className="rounded-card bg-white p-4 shadow-card">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${toneText}`}>
        {value}
        <span className="ml-0.5 text-sm font-medium text-slate-400">{unit}</span>
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { subjects, profile } = useProfile();
  const [results, setResults] = useState<TestResult[]>([]);
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subject, setSubject] = useState<string>(subjects[0]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!user) return;
    const u1 = watchResults(user.uid, setResults);
    const u2 = watchStudyLogs(user.uid, setStudyLogs);
    const u3 = watchAssignments(user.uid, setAssignments);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [user]);

  // 今週の勉強時間（時間, 小数1桁）
  const weekHours = (sumDurationSince(studyLogs, startOfWeek()) / 3600).toFixed(1);
  // 次の未完了提出物までの日数
  const nextDue = assignments.find((a) => !a.done);
  const nextDueDays = nextDue ? daysUntil(nextDue.dueDate) : null;

  // 科目リストが変わったら、選択中の科目が無効なら先頭に合わせる
  useEffect(() => {
    if (subjects.length > 0 && !subjects.includes(subject)) setSubject(subjects[0]);
  }, [subjects, subject]);

  const subjectResults = useMemo(
    () => results.filter((r) => r.subject === subject),
    [results, subject],
  );

  const chartData: GradePoint[] = subjectResults.map((r) => ({
    label: r.testName,
    score: pct(r.score, r.maxScore),
    target: r.targetScore != null ? pct(r.targetScore, r.maxScore) : null,
  }));

  // サマリー指標（実データから算出）
  const latest = subjectResults[subjectResults.length - 1];
  const latestPct = latest ? pct(latest.score, latest.maxScore) : null;
  const targetPct = latest?.targetScore != null ? pct(latest.targetScore, latest.maxScore) : null;
  const achieve = latestPct != null && targetPct != null ? Math.round((latestPct / targetPct) * 100) : null;

  // 連続記録＆バッジ
  const streak = useMemo(() => calcStreak(studyLogs), [studyLogs]);
  const badges = useMemo(() => calcBadges(studyLogs, assignments), [studyLogs, assignments]);
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="min-h-screen bg-base font-sans text-slate-800">
      {/* ヘッダー: スカイブルーのグラデーション */}
      <header className="rounded-b-[28px] bg-gradient-to-br from-main to-sky-400 px-5 pb-8 pt-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm/relaxed opacity-90">{greeting()}、{profile.displayName} さん 👋</p>
            <h1 className="font-display text-xl font-bold">
              {SCHOOL_LABELS[profile.schoolType]} {profile.grade}
            </h1>
          </div>
          {streak > 0 && (
            <span className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-bold backdrop-blur">
              🔥 {streak}日連続
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto -mt-5 max-w-md space-y-4 px-4 pb-36">
        {/* サマリーカード */}
        <section className="grid grid-cols-3 gap-3">
          <StatCard label="今週の勉強" value={weekHours} unit="h" tone="main" />
          <StatCard
            label="次の提出物"
            value={
              nextDueDays == null ? '—' : nextDueDays < 0 ? '超過' : nextDueDays === 0 ? '今日' : String(nextDueDays)
            }
            unit={nextDueDays != null && nextDueDays > 0 ? '日後' : ''}
            tone="accent"
          />
          <StatCard
            label="目標達成"
            value={achieve != null ? String(Math.min(achieve, 999)) : '—'}
            unit={achieve != null ? '%' : ''}
            tone="success"
          />
        </section>

        {/* 提出物一覧（未完了のタスク） */}
        <HomeAssignments assignments={assignments} colors={profile.subjectColors} />

        {/* 進路アドバイス（Gemini） */}
        <CareerAdvice />

        {/* 得意・不得意レーダー（全科目の概観） */}
        <Suspense fallback={<div className="h-72 animate-pulse rounded-card bg-white shadow-card" />}>
          <SubjectRadar results={results} subjects={subjects} />
        </Suspense>

        {/* 記録グラフ（全教科の推移） */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-2 font-display text-sm font-bold">全教科の記録グラフ（得点率）</h2>
          <Suspense fallback={<ChartSkeleton />}>
            <AllSubjectsChart results={results} subjects={subjects} colors={profile.subjectColors} />
          </Suspense>
        </section>

        {/* 科目セレクター（教科カラー） */}
        <section className="flex flex-wrap gap-2">
          {subjects.map((s) => {
            const c = subjectColor(s, profile.subjectColors);
            return (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className="rounded-full px-3 py-1.5 text-sm font-bold shadow-card transition"
                style={
                  subject === s
                    ? { backgroundColor: c, color: deepen(c, 0.6) }
                    : { backgroundColor: 'white', color: deepen(c, 0.45) }
                }
              >
                {s}
              </button>
            );
          })}
        </section>

        {/* 成績グラフ */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold">{subject}の成績推移（得点率）</h2>
          </div>
          {chartData.length === 0 ? (
            <div className="grid h-52 place-items-center text-center text-sm text-slate-400">
              <div>
                <p className="mb-2 text-3xl">📈</p>
                まだ{subject}の記録がありません。
                <br />
                「成績を追加」から登録しよう！
              </div>
            </div>
          ) : (
            <Suspense fallback={<ChartSkeleton />}>
              <GradeChart data={chartData} subjectName={subject} />
            </Suspense>
          )}
        </section>

        {/* 記録リスト */}
        {subjectResults.length > 0 && (
          <section className="rounded-card bg-white p-4 shadow-card">
            <h2 className="mb-2 font-display text-sm font-bold">{subject}の記録</h2>
            <ul className="divide-y divide-slate-100">
              {[...subjectResults].reverse().map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-bold">{r.testName}</p>
                    <p className="text-xs text-slate-400">{r.testDate}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-main">
                      {r.score}
                      <span className="text-xs text-slate-400">/{r.maxScore}</span>
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`「${r.testName}」の記録を削除しますか？`)) removeResult(r.id);
                      }}
                      aria-label="削除"
                      className="text-slate-300 hover:text-accent"
                    >
                      🗑
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 実績バッジ */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-3 font-display text-sm font-bold">
            実績バッジ <span className="text-slate-400">（{earnedCount}/{badges.length}）</span>
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {badges.map((b) => (
              <div
                key={b.id}
                className={`rounded-[12px] p-2.5 text-center transition ${
                  b.earned ? 'bg-sky-50' : 'bg-slate-50 opacity-50 grayscale'
                }`}
              >
                <p className="text-2xl">{b.earned ? b.emoji : '🔒'}</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{b.name}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{b.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* 追加ボタン（FAB） */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white shadow-card transition active:scale-95"
      >
        ＋ 成績を追加
      </button>

      {showForm && user && (
        <GradeForm uid={user.uid} defaultSubject={subject} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}

/** ホームに出す提出物一覧（未完了のみ・期限が近い順）。 */
function HomeAssignments({
  assignments,
  colors,
}: {
  assignments: Assignment[];
  colors: Record<string, string>;
}) {
  const undone = [...assignments]
    .filter((a) => !a.done)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <section className="rounded-card bg-white p-4 shadow-card">
      <h2 className="mb-2 font-display text-sm font-bold">
        📌 提出物 <span className="text-slate-400">（{undone.length}件）</span>
      </h2>
      {undone.length === 0 ? (
        <p className="py-2 text-center text-sm text-slate-400">未完了の提出物はありません 🎉</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {undone.map((a) => {
            const d = daysUntil(a.dueDate);
            const badge =
              d < 0
                ? { text: `${-d}日超過`, cls: 'bg-accent/10 text-accent' }
                : d === 0
                  ? { text: '今日まで', cls: 'bg-accent/10 text-accent' }
                  : d <= 2
                    ? { text: `あと${d}日`, cls: 'bg-accent/10 text-accent' }
                    : { text: `あと${d}日`, cls: 'bg-sky-100 text-main' };
            const c = a.subject ? subjectColor(a.subject, colors) : null;
            return (
              <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
                <button
                  onClick={() => setAssignmentDone(a.id, true)}
                  aria-label="完了にする"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-slate-300 text-transparent transition hover:border-success hover:text-success"
                >
                  ✓
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-700">{a.title}</p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-400">
                    {a.subject && c && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: c, color: deepen(c, 0.6) }}
                      >
                        {a.subject}
                      </span>
                    )}
                    {a.dueDate}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${badge.cls}`}>
                  {badge.text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
