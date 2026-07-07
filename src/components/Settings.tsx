import { useState } from 'react';
import { useAuth, logout } from '../lib/auth';
import { enableNotifications } from '../lib/messaging';
import {
  useProfile,
  SCHOOL_TYPES,
  SCHOOL_LABELS,
  GRADES,
  DEFAULT_SUBJECTS,
  CAREER_TYPES,
  type SchoolType,
} from '../lib/profile';
import { subjectColor, deepen, PASTEL_PALETTE } from '../lib/colors';

export default function Settings() {
  const { user } = useAuth();
  const { profile, save } = useProfile();
  const [newSubject, setNewSubject] = useState('');
  const [colorTarget, setColorTarget] = useState<string | null>(null);
  const [name, setName] = useState(profile.displayName);
  const [notifMsg, setNotifMsg] = useState<string | null>(null);
  const [notifBusy, setNotifBusy] = useState(false);
  const [goalType, setGoalType] = useState(profile.careerGoal?.type ?? '');
  const [goalTarget, setGoalTarget] = useState(profile.careerGoal?.target ?? '');
  const [goalNote, setGoalNote] = useState(profile.careerGoal?.note ?? '');

  function saveGoal() {
    if (!goalType) return;
    save({ careerGoal: { type: goalType, target: goalTarget.trim(), note: goalNote.trim() } });
  }

  async function turnOnNotifications() {
    if (!user) return;
    setNotifBusy(true);
    const res = await enableNotifications(user.uid);
    setNotifMsg(res.message);
    setNotifBusy(false);
  }

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
    // 追加した教科の色をその場で選んでもらう
    setColorTarget(name);
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
            {profile.subjects.map((s) => {
              const c = subjectColor(s, profile.subjectColors);
              return (
                <span
                  key={s}
                  className="flex items-center gap-0.5 rounded-full py-1.5 pl-3 pr-1.5 text-sm font-bold"
                  style={{ backgroundColor: c, color: deepen(c, 0.6) }}
                >
                  {s}
                  <button
                    onClick={() => setColorTarget(s)}
                    aria-label={`${s}の色を変更`}
                    className="grid h-5 w-5 place-items-center rounded-full text-xs hover:bg-white/60"
                  >
                    🎨
                  </button>
                  <button
                    onClick={() => removeSubject(s)}
                    aria-label={`${s}を削除`}
                    disabled={profile.subjects.length <= 1}
                    className="grid h-5 w-5 place-items-center rounded-full opacity-60 hover:bg-white/60 hover:text-accent disabled:opacity-30"
                  >
                    ✕
                  </button>
                </span>
              );
            })}
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
            ここで編集した科目が、成績入力・グラフ・プリントに反映されます。🎨 をタップすると教科の色を変えられます。
          </p>
        </section>

        {/* 進路目標 */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-2 font-display text-sm font-bold">進路目標</h2>
          <div className="mb-2 flex flex-wrap gap-2">
            {CAREER_TYPES.map((c) => (
              <button
                key={c.value}
                onClick={() => setGoalType(c.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                  goalType === c.value ? 'bg-main text-white' : 'bg-sky-100 text-main'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <input
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value)}
            placeholder="志望先（例: ○○高校 / ○○大学）"
            className="mb-2 w-full rounded-[12px] border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-main focus:ring-2 focus:ring-main/20"
          />
          <input
            value={goalNote}
            onChange={(e) => setGoalNote(e.target.value)}
            placeholder="補足（任意：得意にしたい科目・目標偏差値など）"
            className="mb-2 w-full rounded-[12px] border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-main focus:ring-2 focus:ring-main/20"
          />
          <button
            onClick={saveGoal}
            disabled={!goalType}
            className="w-full rounded-card bg-main py-2.5 text-sm font-bold text-white shadow-card transition active:scale-95 disabled:opacity-40"
          >
            進路目標を保存
          </button>
          <p className="mt-2 text-xs text-slate-400">
            ホームの「進路アドバイス」で、AIが目標に向けた助言を出します。
          </p>
        </section>

        {/* 通知 */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-1 font-display text-sm font-bold">通知</h2>
          <p className="mb-3 text-xs text-slate-400">
            提出物の期限が近づいたら、端末にプッシュ通知でお知らせします。
          </p>
          <button
            onClick={turnOnNotifications}
            disabled={notifBusy}
            className="w-full rounded-card bg-main py-2.5 text-sm font-bold text-white shadow-card transition active:scale-95 disabled:opacity-50"
          >
            {notifBusy ? '設定中…' : '🔔 通知をオンにする'}
          </button>
          {notifMsg && <p className="mt-2 text-xs font-bold text-main">{notifMsg}</p>}
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

      {colorTarget && (
        <ColorPicker
          subject={colorTarget}
          current={subjectColor(colorTarget, profile.subjectColors)}
          onSave={(color) => {
            save({ subjectColors: { ...profile.subjectColors, [colorTarget]: color } });
            setColorTarget(null);
          }}
          onClose={() => setColorTarget(null)}
        />
      )}
    </div>
  );
}

/** 教科カラーの選択モーダル。カラーチャート＋基本の淡い10色パレット。 */
function ColorPicker({
  subject,
  current,
  onSave,
  onClose,
}: {
  subject: string;
  current: string;
  onSave: (color: string) => void;
  onClose: () => void;
}) {
  const [color, setColor] = useState(current);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/30 sm:place-items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[24px] bg-white p-5 shadow-card sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-main">教科の色をえらぶ</h2>
          <button onClick={onClose} aria-label="閉じる" className="text-slate-400">
            ✕
          </button>
        </div>

        {/* プレビュー */}
        <div className="mb-4 text-center">
          <span
            className="inline-block rounded-full px-4 py-1.5 text-sm font-bold"
            style={{ backgroundColor: color, color: deepen(color, 0.6) }}
          >
            {subject}
          </span>
        </div>

        <div className="flex items-start gap-4">
          {/* カラーチャート */}
          <label className="flex shrink-0 cursor-pointer flex-col items-center gap-1">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-16 w-16 cursor-pointer rounded-[12px] border border-slate-200 bg-white p-1"
            />
            <span className="text-xs font-bold text-slate-500">カラーチャート</span>
          </label>

          {/* 基本の淡い10色 */}
          <div className="flex-1">
            <div className="grid grid-cols-5 gap-2">
              {PASTEL_PALETTE.map((p) => (
                <button
                  key={p.color}
                  title={p.name}
                  aria-label={p.name}
                  onClick={() => setColor(p.color)}
                  className={`h-10 w-10 rounded-full border-4 transition active:scale-95 ${
                    color.toLowerCase() === p.color.toLowerCase()
                      ? 'border-main'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: p.color }}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">おすすめの淡い色（基本の10色）</p>
          </div>
        </div>

        <button
          onClick={() => onSave(color)}
          className="mt-5 w-full rounded-card bg-main py-3 text-sm font-bold text-white shadow-card transition active:scale-95"
        >
          この色にする
        </button>
      </div>
    </div>
  );
}
