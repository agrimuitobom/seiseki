import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';

// owner フィールドで本人に絞れるコレクション
const OWNED_COLLECTIONS = [
  'testResults',
  'studyLogs',
  'assignments',
  'wrongAnswers',
  'quizzes',
  'fcmTokens',
];

/**
 * ログインは保持したまま、本人のすべての学習データを削除する。
 * - 成績 / 勉強記録 / 提出物 / 弱点ノート / AI問題 / 通知トークン
 * - プリント（Storage実体＋メタ）
 * - フレンド関係・週間ランキング・進路アドバイス
 * - プロフィール本体（→ 初期設定からやり直しになる）
 * - ローカルのタイマー計測
 * ※ この操作は取り消せない。
 */
export async function resetAllData(uid: string) {
  // 1. owner で絞れるコレクションを一括削除
  for (const col of OWNED_COLLECTIONS) {
    const snap = await getDocs(query(collection(db, col), where('owner', '==', uid)));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
  }

  // 2. プリント（Storage の実体 → メタの順で削除）
  const mats = await getDocs(query(collection(db, 'materials'), where('owner', '==', uid)));
  await Promise.all(
    mats.docs.map(async (d) => {
      const path = (d.data() as { storagePath?: string }).storagePath;
      if (path) await deleteObject(ref(storage, path)).catch(() => {});
      await deleteDoc(d.ref).catch(() => {});
    }),
  );

  // 3. フレンド関係（自分が requester / addressee の両方）
  for (const field of ['requester', 'addressee'] as const) {
    const fs = await getDocs(query(collection(db, 'friendships'), where(field, '==', uid)));
    await Promise.all(fs.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
  }

  // 4. 進路アドバイス（doc id = uid）
  await deleteDoc(doc(db, 'careerAdvice', uid)).catch(() => {});

  // 5. 公開プロフィールの週間ランキングをクリア（doc自体は削除不可なので weekly を空に）
  await setDoc(doc(db, 'publicProfiles', uid), { weekly: {} }, { merge: true }).catch(() => {});

  // 6. プロフィール本体を削除（→ 再オンボーディング）
  await deleteDoc(doc(db, 'users', uid)).catch(() => {});

  // 7. ローカルのタイマーセッション
  try {
    localStorage.removeItem('seiseki.timerSession');
  } catch {
    /* プライベートモードなどは無視 */
  }
}
