import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/profile';
import { requestCareerAdvice, watchAdvice, type Advice } from '../lib/advisor';

export function CareerAdvice() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return watchAdvice(user.uid, setAdvice);
  }, [user]);

  const goal = profile.careerGoal;

  async function run() {
    setErr(null);
    setBusy(true);
    try {
      await requestCareerAdvice();
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '';
      setErr(
        msg.includes('進路目標')
          ? '設定タブで進路目標を登録してください。'
          : 'アドバイスの取得に失敗しました。少し待って再度お試しください。',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card bg-white p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-sm font-bold">🎯 進路アドバイス</h2>
        {goal && (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-main">
            {advice?.goalLabel ?? ''}
            {goal.target ? `・${goal.target}` : ''}
          </span>
        )}
      </div>

      {!goal ? (
        <p className="py-3 text-center text-sm text-slate-400">
          設定タブで<strong className="text-main">進路目標</strong>を登録すると、
          <br />
          AIが目標に向けた「今やるべきこと」を提案します。
        </p>
      ) : (
        <>
          {advice && (
            <div className="space-y-3">
              <p className="rounded-[12px] bg-sky-50 p-3 text-sm leading-relaxed">{advice.summary}</p>

              {advice.steps.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-bold text-slate-500">今やるべきこと</p>
                  <ul className="space-y-1.5">
                    {advice.steps.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="font-bold text-accent">{i + 1}.</span>
                        <span className="leading-relaxed">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {advice.subjects.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-bold text-slate-500">科目ごとのヒント</p>
                  <ul className="space-y-1">
                    {advice.subjects.map((s, i) => (
                      <li key={i} className="text-xs leading-relaxed">
                        <span className="font-bold text-main">{s.subject}：</span>
                        {s.advice}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {err && (
            <p className="mt-2 rounded-[12px] bg-accent/10 px-3 py-2 text-xs font-bold text-accent">
              {err}
            </p>
          )}

          <button
            onClick={run}
            disabled={busy}
            className="mt-3 w-full rounded-card bg-main py-2.5 text-sm font-bold text-white shadow-card transition active:scale-95 disabled:opacity-50"
          >
            {busy ? '考え中…🤖' : advice ? 'アドバイスを更新する' : 'アドバイスをもらう'}
          </button>
          {advice && (
            <p className="mt-1 text-center text-[10px] text-slate-400">
              {new Date(advice.createdAt).toLocaleString()} 更新
            </p>
          )}
        </>
      )}
    </section>
  );
}
