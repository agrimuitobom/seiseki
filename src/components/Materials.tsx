import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/profile';
import {
  watchMaterials,
  uploadMaterial,
  removeMaterial,
  type Material,
} from '../lib/materials';
import {
  generateQuiz,
  type Quiz as QuizType,
  type GenerateOptions,
  type Difficulty,
  type QuizFormat,
} from '../lib/quiz';
import Quiz from './Quiz';

const ACCEPT = 'image/*,application/pdf';
const MAX_BYTES = 20 * 1024 * 1024; // 20MB

const fmtSize = (n: number) =>
  n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

const fileIcon = (type: string) => (type === 'application/pdf' ? '📄' : '🖼️');

export default function Materials() {
  const { user } = useAuth();
  const { subjects } = useProfile();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [subject, setSubject] = useState<string>(subjects[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [quizzingId, setQuizzingId] = useState<string | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<QuizType | null>(null);
  const [optionMaterial, setOptionMaterial] = useState<Material | null>(null);

  async function handleGenerate(m: Material, opts: GenerateOptions) {
    setError(null);
    setOptionMaterial(null);
    setQuizzingId(m.id);
    try {
      const quiz = await generateQuiz(m.id, opts);
      setActiveQuiz(quiz);
    } catch {
      setError('問題の生成に失敗しました。少し待って再度お試しください。');
    } finally {
      setQuizzingId(null);
    }
  }

  useEffect(() => {
    if (!user) return;
    return watchMaterials(user.uid, setMaterials);
  }, [user]);

  // 科目リストが変わったら、選択中の科目が無効なら先頭に合わせる
  useEffect(() => {
    if (subjects.length > 0 && !subjects.includes(subject)) setSubject(subjects[0]);
  }, [subjects, subject]);

  const subjectMaterials = useMemo(
    () => materials.filter((m) => m.subject === subject),
    [materials, subject],
  );

  async function handleFiles(files: FileList | null) {
    if (!files || !user) return;
    setError(null);
    const list = Array.from(files);
    for (const file of list) {
      if (file.size > MAX_BYTES) {
        setError(`「${file.name}」は20MBを超えています。`);
        continue;
      }
    }
    setBusy(true);
    try {
      for (const file of list) {
        if (file.size > MAX_BYTES) continue;
        await uploadMaterial(user.uid, subject, file);
      }
    } catch {
      setError('アップロードに失敗しました。通信環境を確認してください。');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="min-h-screen bg-base font-sans text-slate-800">
      {/* ヘッダー */}
      <header className="rounded-b-[28px] bg-gradient-to-br from-main to-sky-400 px-5 pb-8 pt-6 text-white">
        <p className="text-sm/relaxed opacity-90">授業プリント・資料</p>
        <h1 className="font-display text-xl font-bold">科目ごとに保存しよう 📚</h1>
      </header>

      <main className="mx-auto -mt-5 max-w-md space-y-4 px-4 pb-28">
        {/* 科目セレクター */}
        <section className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                subject === s ? 'bg-main text-white shadow-card' : 'bg-white text-main shadow-card'
              }`}
            >
              {s}
            </button>
          ))}
        </section>

        {/* アップロードエリア */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center gap-1 rounded-card border-2 border-dashed border-sky-200 bg-sky-50 py-6 text-sm font-bold text-main transition active:scale-95 disabled:opacity-50"
          >
            <span className="text-3xl">{busy ? '⏳' : '⬆️'}</span>
            {busy ? 'アップロード中…' : `${subject}のプリントを追加`}
            <span className="text-xs font-medium text-slate-400">画像・PDF / 最大20MB</span>
          </button>
          {error && (
            <p className="mt-3 rounded-[12px] bg-accent/10 px-3 py-2 text-xs font-bold text-accent">
              {error}
            </p>
          )}
        </section>

        {/* 一覧 */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-2 font-display text-sm font-bold">{subject}の資料</h2>
          {subjectMaterials.length === 0 ? (
            <div className="grid place-items-center py-8 text-center text-sm text-slate-400">
              <div>
                <p className="mb-2 text-3xl">📂</p>
                まだ{subject}の資料がありません。
                <br />
                上のボタンから追加しよう！
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {subjectMaterials.map((m) => (
                <li key={m.id} className="py-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{fileIcon(m.contentType)}</span>
                    <a
                      href={m.downloadURL}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate font-bold text-slate-700 hover:text-main">
                        {m.fileName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {fmtSize(m.size)}・{new Date(m.createdAt).toLocaleDateString()}
                      </p>
                    </a>
                    <button
                      onClick={() => removeMaterial(m)}
                      aria-label="削除"
                      className="text-slate-300 hover:text-accent"
                    >
                      🗑
                    </button>
                  </div>
                  <button
                    onClick={() => setOptionMaterial(m)}
                    disabled={quizzingId === m.id}
                    className="mt-2 w-full rounded-[12px] bg-accent/10 py-2 text-xs font-bold text-accent transition active:scale-95 disabled:opacity-60"
                  >
                    {quizzingId === m.id ? '🤖 問題をつくっています…' : '🤖 AIで問題をつくる'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="px-2 text-center text-xs text-slate-400">
          💡 各資料の「AIで問題をつくる」から、プリントを参照した模擬問題（選択＋記述）を生成できます。
        </p>
      </main>

      {optionMaterial && (
        <QuizOptions
          material={optionMaterial}
          onClose={() => setOptionMaterial(null)}
          onGenerate={(opts) => handleGenerate(optionMaterial, opts)}
        />
      )}

      {activeQuiz && <Quiz quiz={activeQuiz} onClose={() => setActiveQuiz(null)} />}
    </div>
  );
}

function QuizOptions({
  material,
  onClose,
  onGenerate,
}: {
  material: Material;
  onClose: () => void;
  onGenerate: (opts: GenerateOptions) => void;
}) {
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [format, setFormat] = useState<QuizFormat>('both');

  const Pill = <T,>({
    value,
    current,
    set,
    label,
  }: {
    value: T;
    current: T;
    set: (v: T) => void;
    label: string;
  }) => (
    <button
      onClick={() => set(value)}
      className={`flex-1 rounded-[12px] py-2 text-sm font-bold transition ${
        current === value ? 'bg-main text-white shadow-card' : 'bg-sky-100 text-main'
      }`}
    >
      {label}
    </button>
  );

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
          <h2 className="font-display text-lg font-bold text-main">AIで問題をつくる</h2>
          <button onClick={onClose} aria-label="閉じる" className="text-slate-400">
            ✕
          </button>
        </div>
        <p className="mb-4 truncate text-xs text-slate-400">{material.fileName}</p>

        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-bold text-slate-500">問題数</p>
            <div className="flex gap-2">
              {[3, 5, 10].map((n) => (
                <Pill key={n} value={n} current={count} set={setCount} label={`${n}問`} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-slate-500">難易度</p>
            <div className="flex gap-2">
              <Pill value={'easy' as Difficulty} current={difficulty} set={setDifficulty} label="やさしい" />
              <Pill value={'normal' as Difficulty} current={difficulty} set={setDifficulty} label="ふつう" />
              <Pill value={'hard' as Difficulty} current={difficulty} set={setDifficulty} label="むずかしい" />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-slate-500">出題形式</p>
            <div className="flex gap-2">
              <Pill value={'both' as QuizFormat} current={format} set={setFormat} label="選択＋記述" />
              <Pill value={'mc' as QuizFormat} current={format} set={setFormat} label="選択のみ" />
              <Pill value={'written' as QuizFormat} current={format} set={setFormat} label="記述のみ" />
            </div>
          </div>
        </div>

        <button
          onClick={() => onGenerate({ count, difficulty, format })}
          className="mt-5 w-full rounded-card bg-accent py-3 text-sm font-bold text-white shadow-card transition active:scale-95"
        >
          🤖 この設定でつくる
        </button>
      </div>
    </div>
  );
}
