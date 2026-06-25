import { useState } from 'react';
import { useAuth, logout } from '../lib/auth';
import {
  useProfile,
  SCHOOL_TYPES,
  SCHOOL_LABELS,
  GRADES,
  DEFAULT_SUBJECTS,
  type SchoolType,
} from '../lib/profile';

export default function Settings() {
  const { user } = useAuth();
  const { profile, save } = useProfile();
  const [newSubject, setNewSubject] = useState('');
  const [name, setName] = useState(profile.displayName);

  // 学校種別を変えると、学年と科目をその種別の初期値に合わせる
  function changeSchool(type: SchoolType) {
    if (type === profile.schoolType) return;
    save({ schoolType: type, grade: GRADES[type][0], subjects: DEFAULT_SUBJECTS[type] });
  }

  function addSubject() {
    const name = newSubject.trim();
    if (!name) return;
    if (profile.subjects.includes(name)) {
      setNewSubject('');
      return;
    }
    save({ subjects: [...profile.subjects, name] });
    setNewSubject('');
  }

  function removeSubject(name: string) {
    if (profile.subjects.length <= 1) return; // 最低1科目は残す
    save({ subjects: profile.subjects.filter((s) => s !== name) });
  }

  function resetSubjects() {
    save({ subjects: DEFAULT_SUBJECTS[profile.schoolType] });
  }

  return (
    <div className="min-h-screen bg-base font-sans text-slate-800">
      <header className="rounded-b-[28px] bg-gradient-to-br from-main to-sky-400 px-5 pb-8 pt-6 text-white">
        <p className="text-sm/relaxed opacity-90">設定</p>
        <h1 className="font-display text-xl font-bold">学校・学年・科目</h1>
      </header>

      <main className="mx-auto -mt-5 max-w-md space-y-4 px-4 pb-28">
        {/* 表示名 */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-2 font-display text-sm font-bold">表示名</h2>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="ニックネーム"
              className="flex-1 rounded-[12px] border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-main focus:ring-2 focus:ring-main/20"
            />
            <button
              onClick={() => name.trim() && save({ displayName: name.trim() })}
              disabled={!name.trim() || name.trim() === profile.displayName}
              className="rounded-[12px] bg-main px-4 text-sm font-bold text-white transition active:scale-95 disabled:opacity-40"
            >
              保存
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">フレンドのランキングに表示される名前です。</p>
        </section>

        {/* 学校種別 */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-2 font-display text-sm font-bold">学校</h2>
          <div className="flex gap-2">
            {SCHOOL_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => changeSchool(t)}
                className={`flex-1 rounded-card py-2.5 text-sm font-bold transition ${
                  profile.schoolType === t ? 'bg-main text-white shadow-card' : 'bg-sky-100 text-main'
                }`}
              >
                {SCHOOL_LABELS[t]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            学校を変えると、学年と科目がその学校の初期設定に切り替わります。
          </p>
        </section>

        {/* 学年 */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-2 font-display text-sm font-bold">学年</h2>
          <div className="flex flex-wrap gap-2">
            {GRADES[profile.schoolType].map((g) => (
              <button
                key={g}
                onClick={() => save({ grade: g })}
                className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                  profile.grade === g ? 'bg-main text-white' : 'bg-sky-100 text-main'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </section>

        {/* 科目 */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold">科目</h2>
            <button onClick={resetSubjects} className="text-xs font-bold text-main">
              初期設定に戻す
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {profile.subjects.map((s) => (
              <span
                key={s}
                className="flex items-center gap-1 rounded-full bg-sky-100 py-1.5 pl-3 pr-1.5 text-sm font-bold text-main"
              >
                {s}
                <button
                  onClick={() => removeSubject(s)}
                  aria-label={`${s}を削除`}
                  disabled={profile.subjects.length <= 1}
                  className="grid h-5 w-5 place-items-center rounded-full text-main/60 hover:bg-white hover:text-accent disabled:opacity-30"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSubject()}
              placeholder="科目を追加（例: 物理）"
              className="flex-1 rounded-[12px] border border-slate-200 px-3 py-2 text-sm outline-none focus:border-main focus:ring-2 focus:ring-main/20"
            />
            <button
              onClick={addSubject}
              className="rounded-[12px] bg-main px-4 text-sm font-bold text-white transition active:scale-95"
            >
              追加
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            ここで編集した科目が、成績入力・グラフ・プリントに反映されます。
          </p>
        </section>

        {/* アカウント */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-1 font-display text-sm font-bold">アカウント</h2>
          <p className="mb-3 truncate text-xs text-slate-400">{user?.email}</p>
          <button
            onClick={() => logout()}
            className="w-full rounded-card bg-slate-100 py-2.5 text-sm font-bold text-slate-600 transition active:scale-95"
          >
            ログアウト
          </button>
        </section>
      </main>
    </div>
  );
}
