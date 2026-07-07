import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { TestResult } from '../lib/grades';
import { subjectColor, deepen } from '../lib/colors';

/**
 * 全教科の成績推移を1枚にまとめた記録グラフ。
 * 教科カラー（を濃くした色）の折れ線で得点率(%)を表示する。
 */
export function AllSubjectsChart({
  results,
  subjects,
  colors,
}: {
  results: TestResult[];
  subjects: string[];
  colors: Record<string, string>;
}) {
  // 日付ごとに { date, 科目: 得点率 } の行をつくる
  const byDate = new Map<string, Record<string, number | string>>();
  for (const r of results) {
    if (r.maxScore <= 0) continue;
    const row = byDate.get(r.testDate) ?? { date: r.testDate };
    row[r.subject] = Math.round((r.score / r.maxScore) * 100);
    byDate.set(r.testDate, row);
  }
  const data = [...byDate.values()].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
  const active = subjects.filter((s) => results.some((r) => r.subject === s));

  if (data.length === 0) {
    return (
      <div className="grid h-40 place-items-center text-center text-sm text-slate-400">
        <div>
          <p className="mb-2 text-3xl">📊</p>
          成績を登録すると、全教科の推移がここに表示されます
        </div>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E0F2FE" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#64748B' }}
            tickFormatter={(d: string) => d.slice(5).replace('-', '/')}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            unit="%"
            tick={{ fontSize: 12, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v: number) => `${v}%`}
            contentStyle={{
              borderRadius: 16,
              border: 'none',
              boxShadow: '0 8px 24px -8px rgba(14,165,233,0.35)',
            }}
            labelStyle={{ fontWeight: 700, color: '#0EA5E9' }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
          {active.map((s) => {
            const c = deepen(subjectColor(s, colors), 0.35);
            return (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                stroke={c}
                strokeWidth={2.5}
                dot={{ r: 3, fill: c }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
