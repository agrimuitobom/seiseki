import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { functions, db } from './firebase';

export type Advice = {
  summary: string;
  steps: string[];
  subjects: { subject: string; advice: string }[];
  goalLabel?: string;
  createdAt: number;
};

const callAdvice = httpsCallable<Record<string, never>, Advice>(functions, 'careerAdvice');

/** 進路アドバイスを生成（Cloud Function を呼ぶ）。 */
export async function requestCareerAdvice(): Promise<Advice> {
  const res = await callAdvice({});
  return res.data;
}

/** 保存済みの最新アドバイスを購読。 */
export function watchAdvice(uid: string, cb: (a: Advice | null) => void) {
  return onSnapshot(doc(db, 'careerAdvice', uid), (s) =>
    cb(s.exists() ? (s.data() as Advice) : null),
  );
}
