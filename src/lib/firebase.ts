import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// 設定値は .env（Vite の VITE_ プレフィックス）から読み込む。
// 値は Firebase コンソール → プロジェクト設定 → 「マイアプリ」から取得し、
// .env.local に貼り付ける（.env.example を参照）。
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// 認証（ログイン）・Firestore（DB）・Storage（答案画像）・Functions（AI問題生成）
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Cloud Functions は Firestore と同じ asia-northeast1 にデプロイする。
export const functions = getFunctions(app, 'asia-northeast1');

export default app;
