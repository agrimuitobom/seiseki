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
import { subjectColor, deepen } from '../lib/colors';
import { WheelPicker } from './WheelPicker';

const today = () => new Date().toISOString().slice(0, 10);

type TimerMode = 'stopwatch' | 'countdown' | 'pomodoro';
type Phase = 'work' | 'break';

const MODES: { id: TimerMode; label: string; emoji: string }[] = [
  { id: 'stopwatch', label: 'ストップウォッチ', emoji: '⏱️' },
  { id: 'countdown', label: 'タイマー', emoji: '⏳' },
  { id: 'pomodoro', label: 'ポモドーロ', emoji: '☕' },
];

// ポモドーロの「作業/休憩」プリセット（分）
const POMO_PRESETS: { work: number; break: number }[] = [
  { work: 25, break: 5 },
  { work: 50, break: 10 },
];

/**
 * 実行中のタイマーセッション。localStorage に保存し、
 * アプリを閉じたり他のタブへ移動しても計測を継続できるようにする。
 * 表示・記録はすべてタイムスタンプから計算する（JSが止まっていてもズレない）。
 */
type TimerSession = {
  mode: TimerMode;
  subject: string;
  startedAt: number; // セッション開始(ms)
  phase: Phase; // ポモドーロの局面
  phaseStartedAt: number; // 現在の局面の開始(ms)
  phaseLenSec: number; // 現在の局面の長さ(秒)。0=ストップウォッチ（無限）
  cycles: number; // 完了した作業セット数
  pomoWork: number; // 分
  pomoBreak: number; // 分
};

const SESSION_KEY = 'seiseki.timerSession';

function loadSession(): TimerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as TimerSession) : null;
  } catch {
    return null;
  }
}
function storeSession(s: TimerSession | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* プライベートモードなどは無視 */
  }
}

/**
 * 現在時刻まで局面の切り替えを進める（バックグラウンド中に過ぎた分を追いつく）。
 * 返り値: 最新セッション（終了時は null）と、勉強時間として保存すべき区間。
 */
function advanceSession(
  s: TimerSession,
  now: number,
): { next: TimerSession | null; chunks: { start: number; end: number }[]; transitions: number } {
  const chunks: { start: number; end: number }[] = [];
  let transitions = 0;
  if (s.mode === 'stopwatch') return { next: s, chunks, transitions };

  let cur = { ...s };
  while (now - cur.phaseStartedAt >= cur.phaseLenSec * 1000) {
    const end = cur.phaseStartedAt + cur.phaseLenSec * 1000;
    transitions++;
    if (cur.mode === 'countdown') {
      // カウントダウン終了：設定時間ぶんを勉強として保存して終わり
      chunks.push({ start: cur.phaseStartedAt, end });
      return { next: null, chunks, transitions };
    }
    if (cur.phase === 'work') {
      chunks.push({ start: cur.phaseStartedAt, end });
      cur = {
        ...cur,
        phase: 'break',
        phaseStartedAt: end,
        phaseLenSec: cur.pomoBreak * 60,
        cycles: cur.cycles + 1,
      };
    } else {
      cur = { ...cur, phase: 'work', phaseStartedAt: end, phaseLenSec: cur.pomoWork * 60 };
    }
  }
  return { next: cur, chunks, transitions };
}

/** 表示する秒数（ストップウォッチ=経過、それ以外=残り）。 */
function calcDisplay(s: TimerSession, now: number): number {
  if (s.mode === 'stopwatch') return Math.max(0, Math.floor((now - s.startedAt) / 1000));
  return Math.max(0, Math.ceil((s.phaseStartedAt + s.phaseLenSec * 1000 - now) / 1000));
}

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

const APP_TITLE = 'UPUP｜成績管理・学習支援';

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
  const { profile } = useProfile();
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [subject, setSubject] = useState(subjects[0]);
  const [mode, setMode] = useState<TimerMode>('stopwatch');
  const [session, setSession] = useState<TimerSession | null>(null);
  const [display, setDisplay] = useState(0);
  // タイマー（カウントダウン）のダイヤル設定
  const [countH, setCountH] = useState(0);
  const [countM, setCountM] = useState(25);
  const [countS, setCountS] = useState(0);
  const [pomo, setPomo] = useState(POMO_PRESETS[0]);

  const sessionRef = useRef<TimerSession | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  const running = session != null;

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!uid) return;
    return watchStudyLogs(uid, setLogs);
  }, [uid]);

  useEffect(() => {
    if (!running && subjects.length > 0 && !subjects.includes(subject)) setSubject(subjects[0]);
  }, [subjects, subject, running]);

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

  // 勉強時間として1区間を保存（5秒未満は誤操作とみなし無視）
  async function saveChunkFor(subj: string, startedAt: number, endedAt: number) {
    if (endedAt - startedAt < 5000) return;
    await addStudyLog(uid, subj, startedAt, endedAt);
    // フレンド内ランキング用に今週の合計へ加算
    await bumpWeeklyStudy(uid, Math.round((endedAt - startedAt) / 1000)).catch(() => {});
  }

  // 局面の追いつき＋state/localStorage への反映
  function applyAdvance(s: TimerSession, now: number, withChime: boolean) {
    const { next, chunks, transitions } = advanceSession(s, now);
    for (const c of chunks) void saveChunkFor(s.subject, c.start, c.end);
    if (transitions > 0 && withChime) chime();
    storeSession(next);
    setSession(next);
    if (next) {
      setMode(next.mode);
      setSubject(next.subject);
      setDisplay(calcDisplay(next, now));
    } else {
      releaseWake();
      setDisplay(0);
    }
    return next;
  }

  // 起動時：進行中のセッションがあれば復元（アプリを閉じていた間の分も追いつく）
  useEffect(() => {
    const s = loadSession();
    if (s) applyAdvance(s, Date.now(), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 計測ループ（表示更新＋局面切り替え）
  useEffect(() => {
    if (!session) return;
    const iv = setInterval(() => {
      const now = Date.now();
      if (session.mode !== 'stopwatch' && now - session.phaseStartedAt >= session.phaseLenSec * 1000) {
        applyAdvance(session, now, true);
      } else {
        setDisplay(calcDisplay(session, now));
      }
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // タブタイトルにも経過を表示（PC で別タブにいても見える）
  useEffect(() => {
    if (!session) {
      document.title = APP_TITLE;
      return;
    }
    document.title = `${fmtClock(display)} ⏱ ${session.subject}`;
    return () => {
      document.title = APP_TITLE;
    };
  }, [session, display]);

  // バックグラウンド時：通知領域に計測中の状態を表示（対応端末・通知許可済みのみ）
  useEffect(() => {
    const onVis = async () => {
      const s = sessionRef.current;
      if (document.visibilityState === 'hidden') {
        if (!s) return;
        try {
          if (!('Notification' in window) || Notification.permission !== 'granted') return;
          const reg = await navigator.serviceWorker?.getRegistration();
          const label =
            s.mode === 'pomodoro' ? (s.phase === 'work' ? '（作業中🍅）' : '（休憩中☕）') : '';
          await reg?.showNotification('⏱️ 計測をつづけています', {
            body: `${s.subject}${label} — アプリに戻ると経過が反映されます`,
            tag: 'seiseki-timer',
            silent: true,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
          });
        } catch {
          /* 通知が使えない環境は無視 */
        }
      } else {
        // 戻ってきたら追いつき＋WakeLock再取得＋通知を消す
        if (s) {
          applyAdvance(s, Date.now(), false);
          void acquireWake();
        }
        try {
          const reg = await navigator.serviceWorker?.getRegistration();
          (await reg?.getNotifications({ tag: 'seiseki-timer' }))?.forEach((n) => n.close());
        } catch {
          /* 無視 */
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // アンマウント時：WakeLock だけ解放（セッションは localStorage で継続）
  useEffect(() => () => releaseWake(), []);

  const countTotal = countH * 3600 + countM * 60 + countS;

  function start() {
    const now = Date.now();
    const base = {
      subject,
      startedAt: now,
      phase: 'work' as Phase,
      phaseStartedAt: now,
      cycles: 0,
      pomoWork: pomo.work,
      pomoBreak: pomo.break,
    };
    let s: TimerSession;
    if (mode === 'stopwatch') {
      s = { ...base, mode, phaseLenSec: 0 };
    } else if (mode === 'countdown') {
      if (countTotal <= 0) return;
      s = { ...base, mode, phaseLenSec: countTotal };
    } else {
      s = { ...base, mode, phaseLenSec: pomo.work * 60 };
    }
    storeSession(s);
    setSession(s);
    setDisplay(calcDisplay(s, now));
    void acquireWake();
  }

  async function stop() {
    const s = sessionRef.current;
    if (!s) return;
    const now = Date.now();
    storeSession(null);
    setSession(null);
    releaseWake();
    setDisplay(0);
    // 作業中のぶんを記録（ポモドーロの休憩中は記録しない）
    if (s.mode !== 'pomodoro' || s.phase === 'work') {
      await saveChunkFor(s.subject, s.phaseStartedAt, now);
    }
  }

  const todaySec = useMemo(() => sumDurationSince(logs, startOfToday()), [logs]);
  const weekSec = useMemo(() => sumDurationSince(logs, startOfWeek()), [logs]);
  const recent = logs.slice(0, 5);

  const onBreak = session?.mode === 'pomodoro' && session.phase === 'break';
  const activeSubject = session?.subject ?? subject;
  const statusText = session
    ? session.mode === 'pomodoro'
      ? `${session.phase === 'work' ? '作業中 🍅' : '休憩中 ☕'}・完了 ${session.cycles} セット`
      : `${session.subject} を勉強中`
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
        <div className="mb-3 flex items-center justify-center gap-1 rounded-card bg-white">
          <WheelPicker value={countH} onChange={setCountH} max={9} label="時間" />
          <span className="pb-5 font-display text-xl font-bold text-slate-300">:</span>
          <WheelPicker value={countM} onChange={setCountM} max={59} label="分" />
          <span className="pb-5 font-display text-xl font-bold text-slate-300">:</span>
          <WheelPicker value={countS} onChange={setCountS} max={59} label="秒" />
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

      {/* 科目（教科カラー） */}
      <div className="mb-3 flex flex-wrap gap-2">
        {subjects.map((s) => {
          const c = subjectColor(s, profile.subjectColors);
          const selected = activeSubject === s;
          return (
            <button
              key={s}
              disabled={running}
              onClick={() => setSubject(s)}
              className="rounded-full px-3 py-1.5 text-sm font-bold transition disabled:opacity-60"
              style={
                selected
                  ? { backgroundColor: c, color: deepen(c, 0.6) }
                  : { backgroundColor: '#F1F5F9', color: deepen(c, 0.45) }
              }
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* 表示 */}
      <p
        className={`text-center font-display text-5xl font-bold tabular-nums ${
          onBreak ? 'text-success' : 'text-main'
        }`}
      >
        {fmtClock(display)}
      </p>
      <p className="mb-4 text-center text-xs text-slate-400">{statusText}</p>

      {!running ? (
        <button
          onClick={start}
          disabled={mode === 'countdown' && countTotal <= 0}
          className="w-full rounded-card bg-success py-3 text-sm font-bold text-white shadow-card transition active:scale-95 disabled:opacity-40"
        >
          ▶ スタート
          {mode === 'countdown' && countTotal > 0 && `（${fmtDuration(countTotal)}）`}
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
      {running && (
        <p className="mt-2 text-center text-[11px] text-slate-400">
          アプリを閉じたり他のタブへ移動しても、計測はつづきます
        </p>
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
          {recent.map((l) => {
            const c = subjectColor(l.subject, profile.subjectColors);
            return (
              <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-bold"
                    style={{ backgroundColor: c, color: deepen(c, 0.6) }}
                  >
                    {l.subject}
                  </span>
                  <span className="text-xs text-slate-400">
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
            );
          })}
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
