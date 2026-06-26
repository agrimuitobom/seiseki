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

const ChartSkeleton = () => (
  <div className="h-52 w-full animate-pulse rounded-[12px] bg-sky-50" />
);
import { watchStudyLogs, sumDurationSince, startOfWeek, type StudyLog } from '../lib/study';
import { watchAssignments, daysUntil, type Assignment } from '../lib/assignments';

const pct = (score: number, max: number) => (max > 0 ? Math.round((score / max) * 100) : 0);

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

  return (
    <div className="min-h-screen bg-base font-sans text-slate-800">
      {/* ヘッダー: スカイブルーのグラデーション */}
      <header className="rounded-b-[28px] bg-gradient-to-br from-main to-sky-400 px-5 pb-8 pt-6 text-white">
        <p className="text-sm/relaxed opacity-90">こんにちは、{profile.displayName} さん 👋</p>
        <h1 className="font-display text-xl font-bold">
          {SCHOOL_LABELS[profile.schoolType]} {profile.grade}
        </h1>
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

        {/* 進路アドバイス（Gemini） */}
        <CareerAdvice />

        {/* 得意・不得意レーダー（全科目の概観） */}
        <Suspense fallback={<div className="h-72 animate-pulse rounded-card bg-white shadow-card" />}>
          <SubjectRadar results={results} subjects={subjects} />
        </Suspense>

        {/* 科目セレクター */}
        <section className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                subject === s ? 'bg-main text-white shadow-card' : 'bg-white text-main shadow-card'
              }`}
            >
              {s}
            </button>
          ))}
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
                      onClick={() => removeResult(r.id)}
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
