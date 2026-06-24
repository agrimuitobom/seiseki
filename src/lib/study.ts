import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';

export type StudyLog = {
  id: string;
  owner: string;
  subject: string;
  startedAt: number; // ms
  endedAt: number; // ms
  durationSec: number;
};

const colRef = collection(db, 'studyLogs');

/** 本人の勉強記録を購読（新しい順）。 */
export function watchStudyLogs(uid: string, cb: (rows: StudyLog[]) => void) {
  const q = query(colRef, where('owner', '==', uid));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StudyLog, 'id'>) }));
    rows.sort((a, b) => b.startedAt - a.startedAt);
    cb(rows);
  });
}

/** 勉強記録を追加。 */
export function addStudyLog(uid: string, subject: string, startedAt: number, endedAt: number) {
  const durationSec = Math.max(0, Math.round((endedAt - startedAt) / 1000));
  return addDoc(colRef, { owner: uid, subject, startedAt, endedAt, durationSec, createdAt: Date.now() });
}

export function removeStudyLog(id: string) {
  return deleteDoc(doc(db, 'studyLogs', id));
}

// --- 期間ヘルパー ---
export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** 月曜始まりの週の開始時刻（ms）。 */
export const startOfWeek = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const mondayOffset = (d.getDay() + 6) % 7; // 月=0
  d.setDate(d.getDate() - mondayOffset);
  return d.getTime();
};

export const sumDurationSince = (logs: StudyLog[], sinceMs: number) =>
  logs.filter((l) => l.startedAt >= sinceMs).reduce((acc, l) => acc + l.durationSec, 0);

/** 秒を「○時間○分」/「○分」に整形。 */
export const fmtDuration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}時間${m}分`;
  if (m > 0) return `${m}分`;
  return `${sec}秒`;
};

/** タイマー表示用 HH:MM:SS。 */
export const fmtClock = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};
