import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export type GradePoint = {
  label: string; // テスト名
  score: number; // 得点率（%）
  target?: number | null; // 目標の得点率（%）
};

/**
 * 成績推移グラフ。得点率（%）で表示。
 * - 主線（得点率）: スカイブルー #0EA5E9
 * - 目標ライン: コーラル #FF7E5F（半透明・点線）
 */
export function GradeChart({ data, subjectName }: { data: GradePoint[]; subjectName?: string }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E0F2FE" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: '#64748B' }}
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
          {/* 今回の成績（主線・スカイブルー） */}
          <Line
            type="monotone"
            dataKey="score"
            name={subjectName ? `${subjectName}の得点率` : '得点率'}
            stroke="#0EA5E9"
            strokeWidth={3}
            dot={{ r: 4, fill: '#0EA5E9' }}
            activeDot={{ r: 6 }}
            connectNulls
          />
          {/* 目標の重ね合わせ（半透明コーラル） */}
          <Line
            type="monotone"
            dataKey="target"
            name="目標"
            stroke="#FF7E5F"
            strokeWidth={2}
            strokeOpacity={0.5}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
