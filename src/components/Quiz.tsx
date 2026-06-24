import { useState } from 'react';
import { useAuth } from '../lib/auth';
import type { Quiz as QuizType } from '../lib/quiz';
import { saveWrongAnswers, markMastered, bumpReview } from '../lib/wrongAnswers';

const norm = (s: string) => s.trim().replace(/\s+/g, '').toLowerCase();

export default function Quiz({
  quiz,
  mode = 'generate',
  onClose,
}: {
  quiz: QuizType;
  // generate: 教材から生成 → 間違いを弱点ノートに保存できる
  // review: 弱点ノートから再出題 → 正解はマスター、不正解は復習回数+1
  mode?: 'generate' | 'review';
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [writtenMark, setWrittenMark] = useState<Record<number, 'o' | 'x'>>({});
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  // 各問題の正誤を判定（mc=自動 / written=自己採点）
  function isCorrect(i: number): boolean {
    const q = quiz.questions[i];
    if (q.type === 'mc') return norm(answers[i] ?? '') === norm(q.answer);
    return writtenMark[i] === 'o';
  }
  const wrongIndexes = quiz.questions.map((_, i) => i).filter((i) => !isCorrect(i));
  const allMarked = quiz.questions.every((q, i) => q.type !== 'written' || writtenMark[i]);
  const mcScore = quiz.questions.filter((q, i) => q.type === 'mc' && isCorrect(i)).length;
  const mcTotal = quiz.questions.filter((q) => q.type === 'mc').length;

  // generate: 間違いを弱点ノートに保存
  async function handleSave() {
    if (!user) return;
    setBusy(true);
    try {
      const wrongs = wrongIndexes.map((i) => quiz.questions[i]);
      const n = await saveWrongAnswers(user.uid, quiz.subject, wrongs);
      setDone(n > 0 ? `${n}問を弱点ノートに保存しました📕` : 'すでに登録済みでした');
    } catch {
      setDone('保存に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  // review: 正解→マスター / 不正解→復習回数+1
  async function handleReview() {
    setBusy(true);
    try {
      let mastered = 0;
      await Promise.all(
        quiz.questions.map((q, i) => {
          if (!q.id) return Promise.resolve();
          if (isCorrect(i)) {
            mastered += 1;
            return markMastered(q.id);
          }
          return bumpReview(q.id);
        }),
      );
      setDone(`${mastered}問をマスターしました🎉 ノートから外しました`);
    } catch {
      setDone('記録に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30" onClick={onClose}>
      <div className="mx-auto my-6 max-w-md px-4">
        <div className="rounded-card bg-white p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-main">
                {mode === 'review' ? '📕 弱点克服テスト' : `🤖 AIが作った${quiz.subject}の問題`}
              </p>
              <h2 className="font-display text-lg font-bold">{quiz.title}</h2>
            </div>
            <button onClick={onClose} aria-label="閉じる" className="text-slate-400">
              ✕
            </button>
          </div>

          {revealed && mcTotal > 0 && (
            <div className="mb-4 rounded-card bg-success/10 p-3 text-center">
              <p className="text-xs font-bold text-success">選択問題の正解数</p>
              <p className="font-display text-2xl font-bold text-success">
                {mcScore} <span className="text-sm text-slate-400">/ {mcTotal}</span>
              </p>
            </div>
          )}

          <ol className="space-y-5">
            {quiz.questions.map((q, i) => {
              const a = answers[i] ?? '';
              const correct = isCorrect(i);
              return (
                <li key={i}>
                  <p className="mb-2 text-sm font-bold">
                    <span className="mr-1 text-main">Q{i + 1}.</span>
                    {q.question}
                    <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-main">
                      {q.type === 'mc' ? '選択' : '記述'}
                    </span>
                  </p>

                  {q.type === 'mc' ? (
                    <div className="space-y-1.5">
                      {q.choices.map((c) => {
                        const selected = a === c;
                        const showAsAnswer = revealed && norm(c) === norm(q.answer);
                        return (
                          <button
                            key={c}
                            disabled={revealed}
                            onClick={() => setAnswers((p) => ({ ...p, [i]: c }))}
                            className={`block w-full rounded-[12px] border px-3 py-2 text-left text-sm transition ${
                              showAsAnswer
                                ? 'border-success bg-success/10 font-bold text-success'
                                : selected
                                  ? 'border-main bg-sky-50 font-bold text-main'
                                  : 'border-slate-200 text-slate-700'
                            }`}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea
                      value={a}
                      disabled={revealed}
                      onChange={(e) => setAnswers((p) => ({ ...p, [i]: e.target.value }))}
                      placeholder="答えを入力"
                      rows={2}
                      className="w-full rounded-[12px] border border-slate-200 px-3 py-2 text-sm outline-none focus:border-main focus:ring-2 focus:ring-main/20"
                    />
                  )}

                  {revealed && (
                    <div className="mt-2 rounded-[12px] bg-slate-50 p-3 text-xs">
                      <p>
                        <span className="font-bold text-success">正解：</span>
                        {q.answer}
                        {q.type === 'mc' && (
                          <span className={`ml-2 font-bold ${correct ? 'text-success' : 'text-accent'}`}>
                            {correct ? '⭕️' : '❌'}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 leading-relaxed text-slate-500">
                        <span className="font-bold">解説：</span>
                        {q.explanation}
                      </p>

                      {/* 記述は自己採点 */}
                      {q.type === 'written' && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="font-bold text-slate-600">自己採点:</span>
                          <button
                            onClick={() => setWrittenMark((p) => ({ ...p, [i]: 'o' }))}
                            className={`rounded-full px-3 py-1 font-bold ${
                              writtenMark[i] === 'o' ? 'bg-success text-white' : 'bg-white text-success ring-1 ring-success'
                            }`}
                          >
                            ⭕️ できた
                          </button>
                          <button
                            onClick={() => setWrittenMark((p) => ({ ...p, [i]: 'x' }))}
                            className={`rounded-full px-3 py-1 font-bold ${
                              writtenMark[i] === 'x' ? 'bg-accent text-white' : 'bg-white text-accent ring-1 ring-accent'
                            }`}
                          >
                            ❌ まちがえた
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {/* アクション */}
          <div className="mt-5">
            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="w-full rounded-card bg-main py-3 text-sm font-bold text-white shadow-card transition active:scale-95"
              >
                答え合わせ
              </button>
            ) : done ? (
              <div>
                <p className="mb-3 rounded-[12px] bg-success/10 px-3 py-2 text-center text-sm font-bold text-success">
                  {done}
                </p>
                <button
                  onClick={onClose}
                  className="w-full rounded-card bg-success py-3 text-sm font-bold text-white shadow-card transition active:scale-95"
                >
                  おわる
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {!allMarked && (
                  <p className="text-center text-xs font-bold text-accent">
                    記述問題は ⭕️/❌ で自己採点してください
                  </p>
                )}
                {mode === 'generate' ? (
                  wrongIndexes.length > 0 ? (
                    <button
                      onClick={handleSave}
                      disabled={busy || !allMarked}
                      className="w-full rounded-card bg-accent py-3 text-sm font-bold text-white shadow-card transition active:scale-95 disabled:opacity-50"
                    >
                      {busy ? '保存中…' : `📕 間違い${wrongIndexes.length}問を弱点ノートに保存`}
                    </button>
                  ) : (
                    <p className="rounded-[12px] bg-success/10 px-3 py-2 text-center text-sm font-bold text-success">
                      全問正解！🎉
                    </p>
                  )
                ) : (
                  <button
                    onClick={handleReview}
                    disabled={busy || !allMarked}
                    className="w-full rounded-card bg-main py-3 text-sm font-bold text-white shadow-card transition active:scale-95 disabled:opacity-50"
                  >
                    {busy ? '記録中…' : '復習結果を記録する'}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-full rounded-card bg-slate-100 py-2.5 text-sm font-bold text-slate-600 transition active:scale-95"
                >
                  閉じる
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
