import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { SUBJECTS } from './GradeForm';
import {
  watchMaterials,
  uploadMaterial,
  removeMaterial,
  type Material,
} from '../lib/materials';

const ACCEPT = 'image/*,application/pdf';
const MAX_BYTES = 20 * 1024 * 1024; // 20MB

const fmtSize = (n: number) =>
  n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

const fileIcon = (type: string) => (type === 'application/pdf' ? '📄' : '🖼️');

export default function Materials() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [subject, setSubject] = useState<string>(SUBJECTS[1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    return watchMaterials(user.uid, setMaterials);
  }, [user]);

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
          {SUBJECTS.map((s) => (
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
                <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="text-xl">{fileIcon(m.contentType)}</span>
                  <a
                    href={m.downloadURL}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate font-bold text-slate-700 hover:text-main">{m.fileName}</p>
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
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* フェーズ2の予告 */}
        <p className="px-2 text-center text-xs text-slate-400">
          💡 近日：ここに保存したプリントを参照して、AIが模擬問題を自動作成します。
        </p>
      </main>
    </div>
  );
}
