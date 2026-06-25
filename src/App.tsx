import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { ProfileProvider } from './lib/profile';
import { listenForegroundMessages } from './lib/messaging';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Study from './components/Study';
import Materials from './components/Materials';
import Weakness from './components/Weakness';
import Friends from './components/Friends';
import Settings from './components/Settings';

type Tab = 'home' | 'study' | 'materials' | 'weakness' | 'friends' | 'settings';

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'home', label: 'ホーム', emoji: '🏠' },
  { id: 'study', label: '学習', emoji: '⏱️' },
  { id: 'materials', label: 'プリント', emoji: '📚' },
  { id: 'weakness', label: '弱点', emoji: '📕' },
  { id: 'friends', label: 'フレンド', emoji: '👥' },
  { id: 'settings', label: '設定', emoji: '⚙️' },
];

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
      {tab === 'home' && <Dashboard />}
      {tab === 'study' && <Study />}
      {tab === 'materials' && <Materials />}
      {tab === 'weakness' && <Weakness />}
      {tab === 'friends' && <Friends />}
      {tab === 'settings' && <Settings />}
      <BottomNav tab={tab} onChange={setTab} />
    </>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-base font-sans text-main">
        読み込み中…
      </div>
    );
  }
  if (!user) return <Login />;
  return (
    <ProfileProvider>
      <Shell />
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
