import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import type { TestResult } from '../lib/grades';

const pct = (score: number, max: number) => (max > 0 ? Math.round((score / max) * 100) : 0);

type Row = { subject: string; score: number; target: number | null };

/**
 * 科目ごとの「最新テストの得点率」をレーダーで表示。
 * 得意/不得意がひと目で分かる。目標がある科目は目標ラインも重ねる。
 */
export function SubjectRadar({
  results,
  subjects,
}: {
  results: TestResult[];
  subjects: string[];
}) {
  // 科目ごとの最新結果（results は testDate 昇順）
  const rows: Row[] = subjects
    .map((subject) => {
      const list = results.filter((r) => r.subject === subject);
      if (list.length === 0) return null;
      const latest = list[list.length - 1];
      return {
        subject,
        score: pct(latest.score, latest.maxScore),
        target: latest.targetScore != null ? pct(latest.targetScore, latest.maxScore) : null,
      };
    })
    .filter((r): r is Row => r !== null);

  if (rows.length < 3) {
    return (
      <section className="rounded-card bg-white p-4 shadow-card">
        <h2 className="mb-2 font-display text-sm font-bold">得意・不得意レーダー</h2>
        <div className="grid h-40 place-items-center text-center text-sm text-slate-400">
          <div>
            <p className="mb-2 text-3xl">🕸️</p>
            3科目以上の成績を登録すると
            <br />
            得意・不得意のレーダーが表示されます。
          </div>
        </div>
      </section>
    );
  }

  const hasTarget = rows.some((r) => r.target != null);
  const best = rows.reduce((a, b) => (b.score > a.score ? b : a));
  const worst = rows.reduce((a, b) => (b.score < a.score ? b : a));

  return (
    <section className="rounded-card bg-white p-4 shadow-card">
      <h2 className="mb-1 font-display text-sm font-bold">得意・不得意レーダー</h2>
      <p className="mb-2 text-xs text-slate-400">各科目の最新テストの得点率</p>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={rows} outerRadius="68%">
            <PolarGrid stroke="#E0F2FE" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#64748B' }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Radar
              name="得点率"
              dataKey="score"
              stroke="#0EA5E9"
              fill="#0EA5E9"
              fillOpacity={0.35}
            />
            {hasTarget && (
              <Radar
                name="目標"
                dataKey="target"
                stroke="#FF7E5F"
                fill="#FF7E5F"
                fillOpacity={0.08}
              />
            )}
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 flex justify-around text-center text-xs">
        <div>
          <p className="text-slate-400">得意</p>
          <p className="font-bold text-success">
            {best.subject} {best.score}%
          </p>
        </div>
        <div>
          <p className="text-slate-400">のびしろ</p>
          <p className="font-bold text-accent">
            {worst.subject} {worst.score}%
          </p>
        </div>
      </div>
    </section>
  );
}
