import { useState, type FormEvent } from 'react';
import { login, signup } from '../lib/auth';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await signup(email, password);
      // 成功すると AuthProvider が自動で画面を切り替える
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-base px-4 font-sans text-slate-800">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-card bg-gradient-to-br from-main to-sky-400 text-3xl shadow-card">
            📘
          </div>
          <h1 className="font-display text-2xl font-extrabold text-main">Seiseki</h1>
          <p className="mt-1 text-sm text-slate-500">成績管理・学習支援アプリ</p>
        </div>

        {/* タブ */}
        <div className="mb-4 flex rounded-card bg-sky-100 p-1 text-sm font-bold">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 rounded-[12px] py-2 transition ${
              mode === 'login' ? 'bg-white text-main shadow-card' : 'text-slate-500'
            }`}
          >
            ログイン
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 rounded-[12px] py-2 transition ${
              mode === 'signup' ? 'bg-white text-main shadow-card' : 'text-slate-500'
            }`}
          >
            新規登録
          </button>
        </div>

        <form onSubmit={handleSubmit} className="rounded-card bg-white p-5 shadow-card">
          <label className="mb-1 block text-xs font-bold text-slate-500">メールアドレス</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-3 w-full rounded-[12px] border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-main focus:ring-2 focus:ring-main/20"
            placeholder="you@example.com"
          />

          <label className="mb-1 block text-xs font-bold text-slate-500">パスワード</label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[12px] border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-main focus:ring-2 focus:ring-main/20"
            placeholder="6文字以上"
          />

          {error && (
            <p className="mt-3 rounded-[12px] bg-accent/10 px-3 py-2 text-xs font-bold text-accent">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-card bg-main py-3 text-sm font-bold text-white shadow-card transition active:scale-95 disabled:opacity-50"
          >
            {busy ? '処理中…' : mode === 'login' ? 'ログイン' : 'アカウント作成'}
          </button>
        </form>
      </div>
    </div>
  );
}

function toMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'メールアドレスの形式が正しくありません。';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'メールアドレスまたはパスワードが違います。';
    case 'auth/email-already-in-use':
      return 'このメールアドレスは登録済みです。ログインしてください。';
    case 'auth/weak-password':
      return 'パスワードは6文字以上にしてください。';
    default:
      return 'エラーが発生しました。時間をおいて再度お試しください。';
  }
}
