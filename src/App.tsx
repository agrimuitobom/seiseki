import { lazy, Suspense, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { ProfileProvider, useProfile } from './lib/profile';
import { listenForegroundMessages } from './lib/messaging';
import Login from './components/Login';

// タブ画面は遅延読み込み（初回ロードを軽量化）
const Dashboard = lazy(() => import('./components/Dashboard'));
const Study = lazy(() => import('./components/Study'));
const Materials = lazy(() => import('./components/Materials'));
const Weakness = lazy(() => import('./components/Weakness'));
const Friends = lazy(() => import('./components/Friends'));
const Settings = lazy(() => import('./components/Settings'));
const Onboarding = lazy(() => import('./components/Onboarding'));

type Tab = 'home' | 'study' | 'materials' | 'weakness' | 'friends' | 'settings';

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'home', label: 'ホーム', emoji: '🏠' },
  { id: 'study', label: '学習', emoji: '⏱️' },
  { id: 'materials', label: 'プリント', emoji: '📚' },
  { id: 'weakness', label: '弱点', emoji: '📕' },
  { id: 'friends', label: 'フレンド', emoji: '👥' },
  { id: 'settings', label: '設定', emoji: '⚙️' },
];

function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-base font-sans text-main">
      <div className="animate-pulse text-center">
        <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-card bg-gradient-to-br from-main to-sky-400 text-2xl shadow-card">
          📈
        </div>
        <p className="text-sm font-bold">読み込み中…</p>
      </div>
    </div>
  );
}

function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition ${
              tab === t.id ? 'text-main' : 'text-slate-400'
            }`}
          >
            <span className="text-lg">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>('home');
  useEffect(() => {
    listenForegroundMessages();
  }, []);
  return (
    <>
      <Suspense fallback={<Loading />}>
        {tab === 'home' && <Dashboard />}
        {tab === 'study' && <Study />}
        {tab === 'materials' && <Materials />}
        {tab === 'weakness' && <Weakness />}
        {tab === 'friends' && <Friends />}
        {tab === 'settings' && <Settings />}
      </Suspense>
      <BottomNav tab={tab} onChange={setTab} />
    </>
  );
}

function Gated() {
  const { loading, needsOnboarding } = useProfile();
  if (loading) return <Loading />;
  return (
    <Suspense fallback={<Loading />}>
      {needsOnboarding ? <Onboarding /> : <Shell />}
    </Suspense>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Login />;
  return (
    <ProfileProvider>
      <Gated />
    </ProfileProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
