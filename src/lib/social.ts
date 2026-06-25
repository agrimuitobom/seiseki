import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { startOfWeek } from './study';

/** 今週（月曜始まり）のキー 'yyyy-mm-dd'。週間勉強時間の集計バケット。 */
export const weekKey = () => {
  const d = new Date(startOfWeek());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export type PublicProfile = {
  uid: string;
  displayName: string;
  friendCode: string;
  weekly?: Record<string, number>; // weekKey -> 秒
};

export type Friendship = {
  id: string;
  requester: string;
  addressee: string;
  status: 'pending' | 'accepted';
};

const pubRef = (uid: string) => doc(db, 'publicProfiles', uid);
const friCol = collection(db, 'friendships');

// 紛らわしい文字（0/O/1/I等）を除いた6桁コード
const randCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

/** 公開プロフィール（表示名・フレンドコード）を用意。コードは初回のみ発行。 */
export async function ensurePublicProfile(uid: string, displayName: string) {
  const snap = await getDoc(pubRef(uid));
  if (!snap.exists()) {
    const code = randCode();
    await setDoc(pubRef(uid), { displayName, friendCode: code, createdAt: Date.now() });
    await setDoc(doc(db, 'friendCodes', code), { uid });
  } else if (snap.data().displayName !== displayName) {
    await updateDoc(pubRef(uid), { displayName });
  }
}

export async function getPublicProfile(uid: string): Promise<PublicProfile | null> {
  const snap = await getDoc(pubRef(uid));
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as Omit<PublicProfile, 'uid'>) };
}

/** 今週の勉強時間（秒）を公開プロフィールに加算（ランキング用）。 */
export async function bumpWeeklyStudy(uid: string, sec: number) {
  await setDoc(pubRef(uid), { weekly: { [weekKey()]: increment(sec) } }, { merge: true });
}

/** フレンドコードから相手を検索。 */
export async function findByFriendCode(code: string): Promise<PublicProfile | null> {
  const map = await getDoc(doc(db, 'friendCodes', code.toUpperCase().trim()));
  if (!map.exists()) return null;
  return getPublicProfile(map.data().uid);
}

export function sendFriendRequest(me: string, other: string) {
  return addDoc(friCol, { requester: me, addressee: other, status: 'pending', createdAt: Date.now() });
}

export function acceptFriendship(id: string) {
  return updateDoc(doc(db, 'friendships', id), { status: 'accepted', respondedAt: Date.now() });
}

export function removeFriendship(id: string) {
  return deleteDoc(doc(db, 'friendships', id));
}

/** 自分が関わる全フレンド関係を購読（requester / addressee の2クエリを統合）。 */
export function watchFriendships(me: string, cb: (rows: Friendship[]) => void) {
  let asReq: Friendship[] = [];
  let asAdd: Friendship[] = [];
  const emit = () => {
    const map = new Map<string, Friendship>();
    [...asReq, ...asAdd].forEach((f) => map.set(f.id, f));
    cb([...map.values()]);
  };
  const u1 = onSnapshot(query(friCol, where('requester', '==', me)), (s) => {
    asReq = s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Friendship, 'id'>) }));
    emit();
  });
  const u2 = onSnapshot(query(friCol, where('addressee', '==', me)), (s) => {
    asAdd = s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Friendship, 'id'>) }));
    emit();
  });
  return () => {
    u1();
    u2();
  };
}
