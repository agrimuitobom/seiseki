import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

export type GradePoint = { test: string; math: number; target: number };

/**
 * 成績推移グラフ。
 * - 主線（今回の成績）: スカイブルー #0EA5E9
 * - 目標ライン: ミント #10B981（点線）
 * - 重ね合わせ（過去/目標推移）: コーラル #FF7E5F（半透明）
 */
export function GradeChart({ data }: { data: GradePoint[] }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E0F2FE" vertical={false} />
          <XAxis
            dataKey="test"
            tick={{ fontSize: 12, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[40, 100]}
            tick={{ fontSize: 12, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 16,
              border: 'none',
              boxShadow: '0 8px 24px -8px rgba(14,165,233,0.35)',
            }}
            labelStyle={{ fontWeight: 700, color: '#0EA5E9' }}
          />
          {/* 目標ライン（点線・ミント） */}
          <ReferenceLine
            y={70}
            stroke="#10B981"
            strokeDasharray="6 4"
            label={{ value: '目標70', fill: '#10B981', fontSize: 11, position: 'right' }}
          />
          {/* 今回の成績（主線・スカイブルー） */}
          <Line
            type="monotone"
            dataKey="math"
            name="数学"
            stroke="#0EA5E9"
            strokeWidth={3}
            dot={{ r: 4, fill: '#0EA5E9' }}
            activeDot={{ r: 6 }}
          />
          {/* 過去/目標の重ね合わせ（半透明コーラル） */}
          <Line
            type="monotone"
            dataKey="target"
            name="目標"
            stroke="#FF7E5F"
            strokeWidth={2}
            strokeOpacity={0.4}
            strokeDasharray="4 4"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
