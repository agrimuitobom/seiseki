import { useState } from 'react';
import type { Quiz as QuizType } from '../lib/quiz';

const norm = (s: string) => s.trim().replace(/\s+/g, '').toLowerCase();

export default function Quiz({ quiz, onClose }: { quiz: QuizType; onClose: () => void }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState(false);

  // 採点（選択問題は自動、記述は完全一致のみ目安）
  const graded = quiz.questions.map((q, i) => {
    const a = answers[i] ?? '';
    const correct = norm(a) === norm(q.answer);
    return { correct, answered: a !== '' };
  });
  const total = quiz.questions.length;
  const score = graded.filter((g) => g.correct).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30" onClick={onClose}>
      <div className="mx-auto my-6 max-w-md px-4">
        <div
          className="rounded-card bg-white p-5 shadow-card"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-main">🤖 AIが作った{quiz.subject}の問題</p>
              <h2 className="font-display text-lg font-bold">{quiz.title}</h2>
            </div>
            <button onClick={onClose} aria-label="閉じる" className="text-slate-400">
              ✕
            </button>
          </div>

          {revealed && (
            <div className="mb-4 rounded-card bg-success/10 p-3 text-center">
              <p className="text-xs font-bold text-success">選択問題の正解数</p>
              <p className="font-display text-2xl font-bold text-success">
                {score} <span className="text-sm text-slate-400">/ {total}</span>
              </p>
            </div>
          )}

          <ol className="space-y-5">
            {quiz.questions.map((q, i) => {
              const a = answers[i] ?? '';
              const isCorrect = graded[i].correct;
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
                          <span className={`ml-2 font-bold ${isCorrect ? 'text-success' : 'text-accent'}`}>
                            {graded[i].answered ? (isCorrect ? '⭕️' : '❌') : ''}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 leading-relaxed text-slate-500">
                        <span className="font-bold">解説：</span>
                        {q.explanation}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mt-5 flex gap-3">
            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="flex-1 rounded-card bg-main py-3 text-sm font-bold text-white shadow-card transition active:scale-95"
              >
                答え合わせ
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 rounded-card bg-success py-3 text-sm font-bold text-white shadow-card transition active:scale-95"
              >
                おわる
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
