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

type TimerMode = 'stopwatch' | 'countdown' | 'pomodoro';
type Phase = 'work' | 'break';

const MODES: { id: TimerMode; label: string; emoji: string }[] = [
  { id: 'stopwatch', label: 'ストップウォッチ', emoji: '⏱️' },
  { id: 'countdown', label: 'タイマー', emoji: '⏳' },
  { id: 'pomodoro', label: 'ポモドーロ', emoji: '🍅' },
];

// タイマー（カウントダウン）の分プリセット
const COUNT_PRESETS = [10, 15, 25, 45, 60];
// ポモドーロの「作業/休憩」プリセット（分）
const POMO_PRESETS: { work: number; break: number }[] = [
  { work: 25, break: 5 },
  { work: 50, break: 10 },
];

/** 残り時間表示用 MM:SS。 */
const fmtMMSS = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(m)}:${pad(s)}`;
};

/** 区切りの合図（短いビープ＋バイブ）。失敗しても無視。 */
function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new Ctx();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g);
    g.connect(ac.destination);
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.12, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.4);
    o.start();
    o.stop(ac.currentTime + 0.4);
    o.onended = () => ac.close();
  } catch {
    /* AudioContext 非対応でも無視 */
  }
  try {
    navigator.vibrate?.(200);
  } catch {
    /* vibrate 非対応でも無視 */
  }
}

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
  const [mode, setMode] = useState<TimerMode>('stopwatch');
  const [running, setRunning] = useState(false);
  const [display, setDisplay] = useState(0); // 表示する秒（経過 or 残り）
  const [countMin, setCountMin] = useState(25); // タイマーの設定分
  const [pomo, setPomo] = useState(POMO_PRESETS[0]); // ポモドーロ設定
  const [phase, setPhase] = useState<Phase>('work'); // ポモドーロの局面
  const [cycles, setCycles] = useState(0); // 完了した作業セット数

  const startRef = useRef<number>(0); // 現在の局面の開始時刻(ms)
  const phaseLenRef = useRef<number>(0); // 現在の局面の長さ(秒)。0=ストップウォッチ
  const modeRef = useRef<TimerMode>('stopwatch');
  const phaseRef = useRef<Phase>('work');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(false);
  const subjectRef = useRef(subject);
  const wakeRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    subjectRef.current = subject;
  }, [subject]);

  useEffect(() => {
    if (!uid) return;
    return watchStudyLogs(uid, setLogs);
  }, [uid]);

  useEffect(() => {
    if (subjects.length > 0 && !subjects.includes(subject)) setSubject(subjects[0]);
  }, [subjects, subject]);

  // タブ移動などで画面が消えても、計測中の作業ぶんは失わず記録する
  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (
        runningRef.current &&
        (modeRef.current !== 'pomodoro' || phaseRef.current === 'work')
      ) {
        void saveChunk(startRef.current, Date.now());
      }
      releaseWake();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // 画面に戻ってきたら Wake Lock を取り直す（バックグラウンドで解除されるため）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && runningRef.current) void acquireWake();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 計測中は画面をスリープさせない（未対応ブラウザでは何もしない）
  async function acquireWake() {
    try {
      wakeRef.current = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      /* 非対応・省電力モードなどは無視 */
    }
  }
  function releaseWake() {
    wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
  }

  // 停止中にモード・設定を変えたら表示を初期化
  useEffect(() => {
    if (running) return;
    if (mode === 'stopwatch') setDisplay(0);
    else if (mode === 'countdown') setDisplay(countMin * 60);
    else {
      setPhase('work');
      setCycles(0);
      setDisplay(pomo.work * 60);
    }
  }, [mode, countMin, pomo, running]);

  const clearTick = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  };

  // 勉強時間として1区間を保存（5秒未満は誤操作とみなし無視）
  async function saveChunk(startedAt: number, endedAt: number) {
    if (endedAt - startedAt >= 5000) {
      await addStudyLog(uid, subjectRef.current, startedAt, endedAt);
      // フレンド内ランキング用に今週の合計へ加算
      await bumpWeeklyStudy(uid, Math.round((endedAt - startedAt) / 1000)).catch(() => {});
    }
  }

  function tick() {
    const now = Date.now();
    const sec = Math.floor((now - startRef.current) / 1000);

    if (modeRef.current === 'stopwatch') {
      setDisplay(sec);
      return;
    }

    const rem = phaseLenRef.current - sec;
    if (rem > 0) {
      setDisplay(rem);
      return;
    }

    // 局面終了
    if (modeRef.current === 'countdown') {
      // 設定時間ぶんを勉強として記録して終了
      void saveChunk(startRef.current, startRef.current + phaseLenRef.current * 1000);
      chime();
      clearTick();
      runningRef.current = false;
      releaseWake();
      setRunning(false);
      setDisplay(countMin * 60);
      return;
    }

    // ポモドーロ：作業↔休憩を切り替え
    if (phaseRef.current === 'work') {
      void saveChunk(startRef.current, now); // 作業ぶんを記録
      setCycles((c) => c + 1);
      phaseRef.current = 'break';
      setPhase('break');
      phaseLenRef.current = pomo.break * 60;
    } else {
      phaseRef.current = 'work';
      setPhase('work');
      phaseLenRef.current = pomo.work * 60;
    }
    startRef.current = now;
    setDisplay(phaseLenRef.current);
    chime();
  }

  function start() {
    modeRef.current = mode;
    startRef.current = Date.now();
    if (mode === 'stopwatch') {
      phaseLenRef.current = 0;
      setDisplay(0);
    } else if (mode === 'countdown') {
      phaseLenRef.current = countMin * 60;
      setDisplay(countMin * 60);
    } else {
      phaseRef.current = 'work';
      setPhase('work');
      setCycles(0);
      phaseLenRef.current = pomo.work * 60;
      setDisplay(pomo.work * 60);
    }
    setRunning(true);
    runningRef.current = true;
    void acquireWake();
    tickRef.current = setInterval(tick, 250);
  }

  async function stop() {
    clearTick();
    runningRef.current = false;
    releaseWake();
    setRunning(false);
    const now = Date.now();
    // 作業中（ストップウォッチ／タイマー／ポモドーロの作業局面）なら記録
    if (
      modeRef.current === 'stopwatch' ||
      modeRef.current === 'countdown' ||
      phaseRef.current === 'work'
    ) {
      await saveChunk(startRef.current, now);
    }
    // 表示を初期化
    if (mode === 'stopwatch') setDisplay(0);
    else if (mode === 'countdown') setDisplay(countMin * 60);
    else {
      setPhase('work');
      setCycles(0);
      setDisplay(pomo.work * 60);
    }
  }

  const todaySec = useMemo(() => sumDurationSince(logs, startOfToday()), [logs]);
  const weekSec = useMemo(() => sumDurationSince(logs, startOfWeek()), [logs]);
  const recent = logs.slice(0, 5);

  const onBreak = mode === 'pomodoro' && phase === 'break';
  const statusText =
    mode === 'pomodoro'
      ? `${phase === 'work' ? '作業中 🍅' : '休憩中 ☕'}・完了 ${cycles} セット`
      : running
        ? `${subject} を勉強中`
        : subject;

  return (
    <section className="rounded-card bg-white p-5 shadow-card">
      <h2 className="mb-3 font-display text-sm font-bold">勉強タイマー</h2>

      {/* モード切替 */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            disabled={running}
            onClick={() => setMode(m.id)}
            className={`rounded-card py-2 text-xs font-bold leading-tight transition disabled:opacity-50 ${
              mode === m.id ? 'bg-main text-white shadow-card' : 'bg-sky-100 text-main'
            }`}
          >
            <span className="block text-base">{m.emoji}</span>
            {m.label}
          </button>
        ))}
      </div>

      {/* モード別の設定（停止中のみ） */}
      {!running && mode === 'countdown' && (
        <div className="mb-3 flex flex-wrap gap-2">
          {COUNT_PRESETS.map((min) => (
            <button
              key={min}
              onClick={() => setCountMin(min)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                countMin === min ? 'bg-main text-white' : 'bg-sky-100 text-main'
              }`}
            >
              {min}分
            </button>
          ))}
        </div>
      )}
      {!running && mode === 'pomodoro' && (
        <div className="mb-3 flex flex-wrap gap-2">
          {POMO_PRESETS.map((p) => (
            <button
              key={p.work}
              onClick={() => setPomo(p)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                pomo.work === p.work ? 'bg-main text-white' : 'bg-sky-100 text-main'
              }`}
            >
              作業{p.work}分／休憩{p.break}分
            </button>
          ))}
        </div>
      )}

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
      <p
        className={`text-center font-display text-5xl font-bold tabular-nums ${
          onBreak ? 'text-success' : 'text-main'
        }`}
      >
        {mode === 'stopwatch' ? fmtClock(display) : fmtMMSS(display)}
      </p>
      <p className="mb-4 text-center text-xs text-slate-400">{statusText}</p>

      {!running ? (
        <button
          onClick={start}
          className="w-full rounded-card bg-success py-3 text-sm font-bold text-white shadow-card transition active:scale-95"
        >
          ▶ スタート
          {mode === 'countdown' && `（${countMin}分）`}
          {mode === 'pomodoro' && `（作業${pomo.work}分）`}
        </button>
      ) : (
        <button
          onClick={stop}
          className="w-full rounded-card bg-accent py-3 text-sm font-bold text-white shadow-card transition active:scale-95"
        >
          {onBreak ? '■ ストップ' : '■ ストップして記録'}
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
                  onClick={() => {
                    if (confirm(`${l.subject}の記録（${fmtDuration(l.durationSec)}）を削除しますか？`))
                      removeStudyLog(l.id);
                  }}
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
                  onClick={() => {
                    if (confirm(`「${a.title}」を削除しますか？`)) removeAssignment(a.id);
                  }}
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
