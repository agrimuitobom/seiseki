import { useEffect, useRef, useState } from 'react';

const ITEM_H = 36; // 1項目の高さ(px)

/**
 * ダイヤル式（ドラムロール式）の数値ピッカー。
 * スクロールスナップで中央の値を選ぶ。中央の数字をタップすると直接入力できる。
 */
export function WheelPicker({
  value,
  onChange,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  max: number; // 0〜max
  label: string; // 「時間」「分」「秒」
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  // 外部から値が変わったとき（リセットなど）にスクロール位置を同期
  useEffect(() => {
    const el = ref.current;
    if (el && !editing && Math.round(el.scrollTop / ITEM_H) !== value) {
      el.scrollTo({ top: value * ITEM_H });
    }
  }, [value, editing]);

  function onScroll() {
    const el = ref.current;
    if (!el || editing) return;
    // スクロールが落ち着いてから値を確定（スナップ完了待ち）
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const v = Math.min(max, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      if (v !== value) onChange(v);
    }, 80);
  }

  function startEdit() {
    setDraft(String(value));
    setEditing(true);
  }

  function commit() {
    const v = Math.min(max, Math.max(0, parseInt(draft || '0', 10) || 0));
    setEditing(false);
    onChange(v);
    ref.current?.scrollTo({ top: v * ITEM_H });
  }

  const digits = String(max).length; // 入力できる桁数（時=1, 分/秒=2）

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* 中央の選択帯 */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-9 -translate-y-1/2 rounded-[10px] bg-sky-100/70" />
        {/* 上下のフェード */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-9 bg-gradient-to-b from-white to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-9 bg-gradient-to-t from-white to-transparent" />

        {/* 直接入力（中央タップ時） */}
        {editing && (
          <input
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, digits))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setEditing(false);
            }}
            aria-label={`${label}を入力`}
            className="absolute inset-x-0 top-1/2 z-30 h-9 w-16 -translate-y-1/2 bg-transparent text-center font-display text-xl font-bold tabular-nums text-main outline-none"
          />
        )}

        <div
          ref={ref}
          onScroll={onScroll}
          className="no-scrollbar relative z-10 h-[108px] w-16 snap-y snap-mandatory overflow-y-scroll py-9"
        >
          {Array.from({ length: max + 1 }, (_, i) => (
            <button
              key={i}
              onClick={() => (i === value ? startEdit() : onChange(i))}
              className={`flex h-9 w-full snap-center items-center justify-center font-display text-xl tabular-nums transition ${
                i === value ? 'font-bold text-main' : 'text-slate-300'
              } ${editing && i === value ? 'opacity-0' : ''}`}
            >
              {String(i).padStart(2, '0')}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs font-bold text-slate-400">{label}</p>
    </div>
  );
}
