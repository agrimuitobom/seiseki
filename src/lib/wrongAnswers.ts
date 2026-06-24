import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import type { QuizQuestion } from './quiz';

export type WrongAnswer = {
  id: string;
  owner: string;
  subject: string;
  type: 'mc' | 'written';
  question: string;
  choices: string[];
  answer: string;
  explanation: string;
  status: 'weak' | 'mastered';
  reviewCount: number;
  createdAt: number;
  lastReviewedAt: number | null;
};

const colRef = collection(db, 'wrongAnswers');

/** 本人の「弱点（未克服）」問題を購読。新しい順。 */
export function watchWeakAnswers(uid: string, cb: (rows: WrongAnswer[]) => void) {
  const q = query(colRef, where('owner', '==', uid));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<WrongAnswer, 'id'>) }))
      .filter((r) => r.status === 'weak');
    rows.sort((a, b) => b.createdAt - a.createdAt);
    cb(rows);
  });
}

/**
 * 間違えた問題を弱点ノートに保存。
 * すでに同じ問題文の弱点が登録済みなら重複保存しない。
 */
export async function saveWrongAnswers(
  uid: string,
  subject: string,
  questions: QuizQuestion[],
): Promise<number> {
  if (questions.length === 0) return 0;

  // 既存の弱点（同一ユーザー）を取得して重複を除く
  const snap = await getDocs(query(colRef, where('owner', '==', uid)));
  const existing = new Set(
    snap.docs
      .map((d) => d.data() as Omit<WrongAnswer, 'id'>)
      .filter((r) => r.status === 'weak')
      .map((r) => r.question),
  );

  let saved = 0;
  await Promise.all(
    questions.map((qn) => {
      if (existing.has(qn.question)) return Promise.resolve();
      saved += 1;
      return addDoc(colRef, {
        owner: uid,
        subject,
        type: qn.type,
        question: qn.question,
        choices: qn.choices ?? [],
        answer: qn.answer,
        explanation: qn.explanation,
        status: 'weak',
        reviewCount: 0,
        createdAt: Date.now(),
        lastReviewedAt: null,
      });
    }),
  );
  return saved;
}

/** 克服した（=マスター）。ノートから外れる。 */
export function markMastered(id: string) {
  return updateDoc(doc(db, 'wrongAnswers', id), {
    status: 'mastered',
    lastReviewedAt: Date.now(),
  });
}

/** 復習したがまだ間違えた → 復習回数を加算。 */
export function bumpReview(id: string) {
  return updateDoc(doc(db, 'wrongAnswers', id), {
    reviewCount: increment(1),
    lastReviewedAt: Date.now(),
  });
}

export function removeWrongAnswer(id: string) {
  return deleteDoc(doc(db, 'wrongAnswers', id));
}
