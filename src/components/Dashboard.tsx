import { GradeChart, type GradePoint } from './GradeChart';

const sampleGrades: GradePoint[] = [
  { test: '4月', math: 62, target: 70 },
  { test: '中間', math: 68, target: 70 },
  { test: '期末', math: 74, target: 70 },
  { test: '夏模試', math: 71, target: 75 },
];

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

function QuickAction({
  label,
  emoji,
  primary = false,
}: {
  label: string;
  emoji: string;
  primary?: boolean;
}) {
  return (
    <button
      className={`flex flex-1 flex-col items-center gap-1 rounded-card px-3 py-4 text-sm font-bold transition active:scale-95 ${
        primary
          ? 'bg-accent text-white shadow-card'
          : 'bg-white text-main shadow-card hover:bg-sky-50'
      }`}
    >
      <span className="text-2xl">{emoji}</span>
      {label}
    </button>
  );
}

/** ダッシュボード（ホーム画面）— スカイブルー・テーマ / 角丸16px */
export default function Dashboard() {
  return (
    <div className="min-h-screen bg-base font-sans text-slate-800">
      {/* ヘッダー: スカイブルーのグラデーション */}
      <header className="rounded-b-[28px] bg-gradient-to-br from-main to-sky-400 px-5 pb-8 pt-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm/relaxed opacity-90">こんにちは、ハルトさん 👋</p>
            <h1 className="font-display text-xl font-bold">今日もコツコツいこう！</h1>
          </div>
          <button className="relative rounded-full bg-white/20 p-2" aria-label="通知">
            🔔
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-main" />
          </button>
        </div>
      </header>

      <main className="mx-auto -mt-5 max-w-md space-y-4 px-4 pb-24">
        {/* サマリーカード */}
        <section className="grid grid-cols-3 gap-3">
          <StatCard label="今週の勉強" value="4.5" unit="h" tone="main" />
          <StatCard label="次の提出物" value="2" unit="日後" tone="accent" />
          <StatCard label="目標達成" value="95" unit="%" tone="success" />
        </section>

        {/* AIアドバイス */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-100 text-lg">
              🤖
            </span>
            <div>
              <p className="text-xs font-bold text-main">AIからのひとこと</p>
              <p className="mt-0.5 text-sm leading-relaxed">
                数学の<b>二次関数</b>で昨日3問ミスがありました。10分の弱点テストで定着させよう！
              </p>
            </div>
          </div>
        </section>

        {/* 成績グラフ */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold">数学の成績推移</h2>
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-bold text-success">
              +12点 ↑
            </span>
          </div>
          <GradeChart data={sampleGrades} />
        </section>

        {/* クイックアクション */}
        <section className="flex gap-3">
          <QuickAction label="勉強開始" emoji="⏱️" />
          <QuickAction label="答案を登録" emoji="📷" primary />
          <QuickAction label="テスト対策" emoji="📝" />
        </section>
      </main>
    </div>
  );
}
