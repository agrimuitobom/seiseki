import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import app, { db } from './firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export type EnableResult = { ok: boolean; message: string };

/** 通知を有効化：許可を取り、FCMトークンを取得して Firestore に保存。 */
export async function enableNotifications(uid: string): Promise<EnableResult> {
  if (!(await isSupported().catch(() => false))) {
    return { ok: false, message: 'この端末・ブラウザは通知に対応していません。' };
  }
  if (!VAPID_KEY) {
    return { ok: false, message: '通知の設定が未構成です（VAPIDキー未設定）。' };
  }
  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, message: '通知が許可されませんでした。ブラウザ設定から許可してください。' };
  }
  try {
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return { ok: false, message: 'トークンを取得できませんでした。' };
    await setDoc(doc(db, 'fcmTokens', token), { owner: uid, createdAt: Date.now() });
    return { ok: true, message: '通知をオンにしました 🔔' };
  } catch (e) {
    console.error('enableNotifications', e);
    return { ok: false, message: '通知の有効化に失敗しました。' };
  }
}

/** アプリ表示中に届いたメッセージを通知として表示。 */
export async function listenForegroundMessages() {
  if (!(await isSupported().catch(() => false))) return;
  try {
    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      const d = payload.data ?? {};
      if (Notification.permission === 'granted') {
        new Notification(d.title || 'Seiseki', { body: d.body || '', icon: '/pwa-192x192.png' });
      }
    });
  } catch {
    // 未対応環境は無視
  }
}
