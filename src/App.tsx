import { AuthProvider, useAuth } from './lib/auth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-base font-sans text-main">
        読み込み中…
      </div>
    );
  }
  return user ? <Dashboard /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
