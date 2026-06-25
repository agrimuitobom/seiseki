import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/profile';
import {
  watchStudyLogs,
  addStudyLog,
  removeStudyLog,
  sumDurationSince,
  startOfToday,
  startOfWeek,
  fmtDuration,
  fmtClock,
  type StudyLog,
} from '../lib/study';
import {
  watchAssignments,
  addAssignment,
  setAssignmentDone,
  removeAssignment,
  daysUntil,
  type Assignment,
} from '../lib/assignments';
import { bumpWeeklyStudy } from '../lib/social';

const today = () => new Date().toISOString().slice(0, 10);

export default function Study() {
  const { user } = useAuth();
  const { subjects } = useProfile();

  return (
    <div className="min-h-screen bg-base font-sans text-slate-800">
      <header className="rounded-b-[28px] bg-gradient-to-br from-main to-sky-400 px-5 pb-8 pt-6 text-white">
        <p className="text-sm/relaxed opacity-90">学習</p>
        <h1 className="font-display text-xl font-bold">タイマー＆提出物 ⏱️</h1>
      </header>

      <main className="mx-auto -mt-5 max-w-md space-y-4 px-4 pb-28">
        {user && <Timer uid={user.uid} subjects={subjects} />}
        {user && <Assignments uid={user.uid} subjects={subjects} />}
      </main>
    </div>
  );
}

function Timer({ uid, subjects }: { uid: string; subjects: string[] }) {
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [subject, setSubject] = useState(subjects[0]);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // 秒
  const startRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!uid) return;
    return watchStudyLogs(uid, setLogs);
  }, [uid]);

  useEffect(() => {
    if (subjects.length > 0 && !subjects.includes(subject)) setSubject(subjects[0]);
  }, [subjects, subject]);

  // アンマウント時にタイマー停止
  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  function start() {
    startRef.current = Date.now();
    setElapsed(0);
    setRunning(true);
    tickRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
  }

  async function stop() {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    setRunning(false);
    const endedAt = Date.now();
    const startedAt = startRef.current;
    setElapsed(0);
    // 5秒未満は誤操作とみなして保存しない
    if (endedAt - startedAt >= 5000) {
      await addStudyLog(uid, subject, startedAt, endedAt);
      // フレンド内ランキング用に今週の合計へ加算
      await bumpWeeklyStudy(uid, Math.round((endedAt - startedAt) / 1000)).catch(() => {});
    }
  }

  const todaySec = useMemo(() => sumDurationSince(logs, startOfToday()), [logs]);
  const weekSec = useMemo(() => sumDurationSince(logs, startOfWeek()), [logs]);
  const recent = logs.slice(0, 5);

  return (
    <section className="rounded-card bg-white p-5 shadow-card">
      <h2 className="mb-3 font-display text-sm font-bold">勉強タイマー</h2>

      {/* 科目 */}
      <div className="mb-3 flex flex-wrap gap-2">
        {subjects.map((s) => (
          <button
            key={s}
            disabled={running}
            onClick={() => setSubject(s)}
            className={`rounded-full px-3 py-1.5 text-sm font-bold transition disabled:opacity-50 ${
              subject === s ? 'bg-main text-white' : 'bg-sky-100 text-main'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* 表示 */}
      <p className="text-center font-display text-5xl font-bold tabular-nums text-main">
        {fmtClock(elapsed)}
      </p>
      <p className="mb-4 text-center text-xs text-slate-400">{subject} を勉強中</p>

      {!running ? (
        <button
          onClick={start}
          className="w-full rounded-card bg-success py-3 text-sm font-bold text-white shadow-card transition active:scale-95"
        >
          ▶ スタート
        </button>
      ) : (
        <button
          onClick={stop}
          className="w-full rounded-card bg-accent py-3 text-sm font-bold text-white shadow-card transition active:scale-95"
        >
          ■ ストップして記録
        </button>
      )}

      {/* 合計 */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-[12px] bg-sky-50 p-3 text-center">
          <p className="text-xs text-slate-500">今日</p>
          <p className="font-display text-lg font-bold text-main">{fmtDuration(todaySec)}</p>
        </div>
        <div className="rounded-[12px] bg-sky-50 p-3 text-center">
          <p className="text-xs text-slate-500">今週</p>
          <p className="font-display text-lg font-bold text-main">{fmtDuration(weekSec)}</p>
        </div>
      </div>

      {/* 最近の記録 */}
      {recent.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100">
          {recent.map((l) => (
            <li key={l.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className="font-bold text-slate-700">{l.subject}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {new Date(l.startedAt).toLocaleDateString()}{' '}
                  {new Date(l.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-bold text-main">{fmtDuration(l.durationSec)}</span>
                <button
                  onClick={() => removeStudyLog(l.id)}
                  aria-label="削除"
                  className="text-slate-300 hover:text-accent"
                >
                  🗑
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Assignments({ uid, subjects }: { uid: string; subjects: string[] }) {
  const [items, setItems] = useState<Assignment[]>([]);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<string>('');
  const [dueDate, setDueDate] = useState(today());

  useEffect(() => {
    if (!uid) return;
    return watchAssignments(uid, setItems);
  }, [uid]);

  async function add() {
    if (!title.trim()) return;
    await addAssignment(uid, {
      title: title.trim(),
      subject: subject || null,
      dueDate,
    });
    setTitle('');
    setSubject('');
    setDueDate(today());
  }

  return (
    <section className="rounded-card bg-white p-5 shadow-card">
      <h2 className="mb-3 font-display text-sm font-bold">提出物・宿題</h2>

      {/* 追加フォーム */}
      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="提出物名（例: 数学ワークP.20）"
          className={inputCls}
        />
        <div className="flex gap-2">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={`${inputCls} flex-1`}
          >
            <option value="">科目なし</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={`${inputCls} flex-1`}
          />
        </div>
        <button
          onClick={add}
          className="w-full rounded-card bg-main py-2.5 text-sm font-bold text-white shadow-card transition active:scale-95"
        >
          ＋ 追加
        </button>
      </div>

      {/* 一覧 */}
      {items.length === 0 ? (
        <p className="mt-4 text-center text-sm text-slate-400">提出物はありません 🎉</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {items.map((a) => {
            const d = daysUntil(a.dueDate);
            const badge = a.done
              ? { text: '完了', cls: 'bg-slate-100 text-slate-400' }
              : d < 0
                ? { text: `${-d}日超過`, cls: 'bg-accent/10 text-accent' }
                : d === 0
                  ? { text: '今日まで', cls: 'bg-accent/10 text-accent' }
                  : d <= 2
                    ? { text: `あと${d}日`, cls: 'bg-accent/10 text-accent' }
                    : { text: `あと${d}日`, cls: 'bg-sky-100 text-main' };
            return (
              <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
                <button
                  onClick={() => setAssignmentDone(a.id, !a.done)}
                  aria-label={a.done ? '未完了に戻す' : '完了にする'}
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${
                    a.done ? 'border-success bg-success text-white' : 'border-slate-300 text-transparent'
                  }`}
                >
                  ✓
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`font-bold ${a.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {a.title}
                  </p>
                  <p className="text-xs text-slate-400">
                    {a.subject ? `${a.subject}・` : ''}
                    {a.dueDate}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${badge.cls}`}>
                  {badge.text}
                </span>
                <button
                  onClick={() => removeAssignment(a.id)}
                  aria-label="削除"
                  className="text-slate-300 hover:text-accent"
                >
                  🗑
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const inputCls =
  'w-full rounded-[12px] border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-main focus:ring-2 focus:ring-main/20';
