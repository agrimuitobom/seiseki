import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';

export type Assignment = {
  id: string;
  owner: string;
  title: string;
  subject: string | null;
  dueDate: string; // yyyy-mm-dd
  done: boolean;
  createdAt: number;
};

export type AssignmentInput = {
  title: string;
  subject: string | null;
  dueDate: string;
};

const colRef = collection(db, 'assignments');

/** 本人の提出物を購読。未完了→期限が近い順、完了は後ろ。 */
export function watchAssignments(uid: string, cb: (rows: Assignment[]) => void) {
  const q = query(colRef, where('owner', '==', uid));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Assignment, 'id'>) }));
    rows.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1; // 未完了が先
      return a.dueDate.localeCompare(b.dueDate); // 期限が近い順
    });
    cb(rows);
  });
}

export function addAssignment(uid: string, input: AssignmentInput) {
  return addDoc(colRef, { ...input, owner: uid, done: false, createdAt: Date.now() });
}

export function setAssignmentDone(id: string, done: boolean) {
  return updateDoc(doc(db, 'assignments', id), { done });
}

export function removeAssignment(id: string) {
  return deleteDoc(doc(db, 'assignments', id));
}

/** 今日からの残り日数（負なら期限切れ）。 */
export function daysUntil(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}
