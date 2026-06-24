import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { watchWeakAnswers, removeWrongAnswer, type WrongAnswer } from '../lib/wrongAnswers';
import type { Quiz as QuizType } from '../lib/quiz';
import Quiz from './Quiz';

const MAX_REVIEW = 10;

const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function Weakness() {
  const { user } = useAuth();
  const [items, setItems] = useState<WrongAnswer[]>([]);
  const [filter, setFilter] = useState<string>('すべて');
  const [reviewQuiz, setReviewQuiz] = useState<QuizType | null>(null);

  useEffect(() => {
    if (!user) return;
    return watchWeakAnswers(user.uid, setItems);
  }, [user]);

  const subjects = useMemo(
    () => ['すべて', ...Array.from(new Set(items.map((i) => i.subject)))],
    [items],
  );
  const filtered = useMemo(
    () => (filter === 'すべて' ? items : items.filter((i) => i.subject === filter)),
    [items, filter],
  );

  function startReview() {
    const picked = shuffle(filtered).slice(0, MAX_REVIEW);
    if (picked.length === 0) return;
    setReviewQuiz({
      quizId: 'review',
      subject: filter === 'すべて' ? 'まとめ' : filter,
      title: `弱点克服テスト（${picked.length}問）`,
      questions: picked.map((w) => ({
        id: w.id,
        type: w.type,
        question: w.question,
        choices: w.choices ?? [],
        answer: w.answer,
        explanation: w.explanation,
      })),
    });
  }

  return (
    <div className="min-h-screen bg-base font-sans text-slate-800">
      <header className="rounded-b-[28px] bg-gradient-to-br from-main to-sky-400 px-5 pb-8 pt-6 text-white">
        <p className="text-sm/relaxed opacity-90">弱点ノート</p>
        <h1 className="font-display text-xl font-bold">間違いを克服しよう 📕</h1>
      </header>

      <main className="mx-auto -mt-5 max-w-md space-y-4 px-4 pb-28">
        {items.length === 0 ? (
          <section className="rounded-card bg-white p-6 shadow-card">
            <div className="grid place-items-center py-6 text-center text-sm text-slate-400">
              <div>
                <p className="mb-2 text-3xl">📕</p>
                まだ弱点はありません。
                <br />
                プリントの「AIで問題をつくる」で出題し、間違えた問題を保存しよう！
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* 科目フィルタ */}
            <section className="flex flex-wrap gap-2">
              {subjects.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                    filter === s ? 'bg-main text-white shadow-card' : 'bg-white text-main shadow-card'
                  }`}
                >
                  {s}
                </button>
              ))}
            </section>

            {/* 再出題 */}
            <section className="rounded-card bg-white p-4 shadow-card">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold">
                  弱点の問題：<span className="text-accent">{filtered.length}</span>問
                </p>
              </div>
              <button
                onClick={startReview}
                disabled={filtered.length === 0}
                className="w-full rounded-card bg-accent py-3 text-sm font-bold text-white shadow-card transition active:scale-95 disabled:opacity-50"
              >
                🎯 弱点だけ再出題（最大{MAX_REVIEW}問）
              </button>
              <p className="mt-2 text-center text-xs text-slate-400">
                正解した問題はノートから自動で外れます。
              </p>
            </section>

            {/* 一覧 */}
            <section className="rounded-card bg-white p-4 shadow-card">
              <ul className="divide-y divide-slate-100">
                {filtered.map((w) => (
                  <li key={w.id} className="flex items-start gap-2 py-2.5 text-sm">
                    <span className="mt-0.5 shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-main">
                      {w.subject}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-slate-700">{w.question}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        正解: {w.answer}
                        {w.reviewCount > 0 && `・復習${w.reviewCount}回`}
                      </p>
                    </div>
                    <button
                      onClick={() => removeWrongAnswer(w.id)}
                      aria-label="削除"
                      className="text-slate-300 hover:text-accent"
                    >
                      🗑
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>

      {reviewQuiz && (
        <Quiz quiz={reviewQuiz} mode="review" onClose={() => setReviewQuiz(null)} />
      )}
    </div>
  );
}
