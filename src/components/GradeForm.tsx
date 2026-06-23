import { useState, type FormEvent } from 'react';
import { addResult } from '../lib/grades';

export const SUBJECTS = ['国語', '数学', '英語', '理科', '社会'] as const;

const today = () => new Date().toISOString().slice(0, 10);

export default function GradeForm({
  uid,
  defaultSubject,
  onClose,
}: {
  uid: string;
  defaultSubject?: string;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(defaultSubject ?? SUBJECTS[1]);
  const [testName, setTestName] = useState('');
  const [testDate, setTestDate] = useState(today());
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [targetScore, setTargetScore] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const s = Number(score);
    const max = Number(maxScore);
    if (!testName.trim()) return setError('テスト名を入力してください。');
    if (!(max > 0)) return setError('満点は1以上にしてください。');
    if (!(s >= 0 && s <= max)) return setError('得点は0〜満点の範囲で入力してください。');

    setBusy(true);
    try {
      await addResult(uid, {
        subject,
        testName: testName.trim(),
        testDate,
        score: s,
        maxScore: max,
        targetScore: targetScore === '' ? null : Number(targetScore),
      });
      onClose();
    } catch {
      setError('保存に失敗しました。通信環境を確認してください。');
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/30 sm:place-items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[24px] bg-white p-5 shadow-card sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-main">成績を追加</h2>
          <button onClick={onClose} aria-label="閉じる" className="text-slate-400">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">科目</label>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSubject(s)}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                    subject === s ? 'bg-main text-white' : 'bg-sky-100 text-main'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <Field label="テスト名">
            <input
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="1学期中間テスト"
              className={inputCls}
            />
          </Field>

          <Field label="実施日">
            <input
              type="date"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              className={inputCls}
            />
          </Field>

          <div className="flex gap-3">
            <Field label="得点">
              <input
                type="number"
                inputMode="numeric"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="78"
                className={inputCls}
              />
            </Field>
            <Field label="満点">
              <input
                type="number"
                inputMode="numeric"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="目標点（任意）">
              <input
                type="number"
                inputMode="numeric"
                value={targetScore}
                onChange={(e) => setTargetScore(e.target.value)}
                placeholder="85"
                className={inputCls}
              />
            </Field>
          </div>

          {error && (
            <p className="rounded-[12px] bg-accent/10 px-3 py-2 text-xs font-bold text-accent">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-card bg-main py-3 text-sm font-bold text-white shadow-card transition active:scale-95 disabled:opacity-50"
          >
            {busy ? '保存中…' : '保存する'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-[12px] border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-main focus:ring-2 focus:ring-main/20';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block flex-1">
      <span className="mb-1 block text-xs font-bold text-slate-500">{label}</span>
      {children}
    </label>
  );
}
