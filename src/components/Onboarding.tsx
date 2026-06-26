import { useState } from 'react';
import { useAuth } from '../lib/auth';
import {
  useProfile,
  SCHOOL_TYPES,
  SCHOOL_LABELS,
  GRADES,
  type SchoolType,
} from '../lib/profile';

export default function Onboarding() {
  const { user } = useAuth();
  const { completeOnboarding } = useProfile();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.email?.split('@')[0] ?? '');
  const [school, setSchool] = useState<SchoolType>('中');
  const [grade, setGrade] = useState('1年');
  const [busy, setBusy] = useState(false);

  function pickSchool(t: SchoolType) {
    setSchool(t);
    setGrade(GRADES[t][0]);
  }

  async function finish() {
    setBusy(true);
    try {
      await completeOnboarding({
        displayName: name.trim() || 'ゲスト',
        schoolType: school,
        grade,
      });
      // 完了すると needsOnboarding=false になり自動で本画面に切り替わる
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-base px-5 font-sans text-slate-800">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-card bg-gradient-to-br from-main to-sky-400 text-3xl shadow-card">
            📈
          </div>
          <h1 className="font-display text-2xl font-extrabold text-main">ようこそ Seiseki へ</h1>
          <p className="mt-1 text-sm text-slate-500">まずは2ステップで初期設定をしましょう</p>
        </div>

        <div className="rounded-card bg-white p-5 shadow-card">
          {/* ステップ表示 */}
          <div className="mb-4 flex justify-center gap-1.5">
            {[0, 1].map((i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 bg-main' : 'w-1.5 bg-sky-200'
                }`}
              />
            ))}
          </div>

          {step === 0 ? (
            <>
              <h2 className="mb-1 font-display text-base font-bold">表示名を決めよう</h2>
              <p className="mb-3 text-xs text-slate-400">フレンドのランキングに表示される名前です。</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder="ニックネーム"
                className="mb-4 w-full rounded-[12px] border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-main focus:ring-2 focus:ring-main/20"
              />
              <button
                onClick={() => setStep(1)}
                disabled={!name.trim()}
                className="w-full rounded-card bg-main py-3 text-sm font-bold text-white shadow-card transition active:scale-95 disabled:opacity-40"
              >
                次へ
              </button>
            </>
          ) : (
            <>
              <h2 className="mb-1 font-display text-base font-bold">学校と学年を選ぼう</h2>
              <p className="mb-3 text-xs text-slate-400">科目はあとから自由に編集できます。</p>

              <p className="mb-1.5 text-xs font-bold text-slate-500">学校</p>
              <div className="mb-3 flex gap-2">
                {SCHOOL_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => pickSchool(t)}
                    className={`flex-1 rounded-card py-2.5 text-sm font-bold transition ${
                      school === t ? 'bg-main text-white shadow-card' : 'bg-sky-100 text-main'
                    }`}
                  >
                    {SCHOOL_LABELS[t]}
                  </button>
                ))}
              </div>

              <p className="mb-1.5 text-xs font-bold text-slate-500">学年</p>
              <div className="mb-4 flex flex-wrap gap-2">
                {GRADES[school].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrade(g)}
                    className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                      grade === g ? 'bg-main text-white' : 'bg-sky-100 text-main'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(0)}
                  className="rounded-card bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600 transition active:scale-95"
                >
                  戻る
                </button>
                <button
                  onClick={finish}
                  disabled={busy}
                  className="flex-1 rounded-card bg-success py-3 text-sm font-bold text-white shadow-card transition active:scale-95 disabled:opacity-50"
                >
                  {busy ? '保存中…' : 'はじめる 🎉'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
