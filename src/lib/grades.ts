import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type TestResult = {
  id: string;
  owner: string;
  subject: string; // 科目（数学・英語…）
  testName: string; // 中間/期末/模試名
  testDate: string; // ISO yyyy-mm-dd
  score: number; // 得点
  maxScore: number; // 満点
  targetScore: number | null; // 目標点（任意）
};

export type TestResultInput = Omit<TestResult, 'id' | 'owner'>;

const colRef = collection(db, 'testResults');

/** 本人のテスト結果を購読（リアルタイム）。日付の昇順でソートして返す。 */
export function watchResults(uid: string, cb: (rows: TestResult[]) => void) {
  // 複合インデックス不要にするため owner だけで絞り、並び替えはクライアント側で行う。
  const q = query(colRef, where('owner', '==', uid));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<TestResult, 'id'>) }),
    );
    rows.sort((a, b) => a.testDate.localeCompare(b.testDate));
    cb(rows);
  });
}

/** テスト結果を追加。owner に自分の uid を必ず付与する（セキュリティルールと一致）。 */
export function addResult(uid: string, input: TestResultInput) {
  return addDoc(colRef, { ...input, owner: uid, createdAt: serverTimestamp() });
}

/** テスト結果を削除。 */
export function removeResult(id: string) {
  return deleteDoc(doc(db, 'testResults', id));
}
