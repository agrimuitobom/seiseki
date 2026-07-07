/**
 * 教科カラー（パステル基調）。
 * 背景に使う淡い色を保存し、文字・線には deepen() で濃くした同系色を使う。
 */

// おすすめの淡い色 10色（カラーピッカーの基本パレット）
export const PASTEL_PALETTE: { color: string; name: string }[] = [
  { color: '#FECACA', name: '淡い赤' },
  { color: '#FED7AA', name: '淡いオレンジ' },
  { color: '#FEF08A', name: '淡い黄' },
  { color: '#BBF7D0', name: '淡い緑' },
  { color: '#99F6E4', name: '淡いティール' },
  { color: '#BAE6FD', name: '淡い水色' },
  { color: '#BFDBFE', name: '淡い青' },
  { color: '#E9D5FF', name: '淡い紫' },
  { color: '#FBCFE8', name: '淡いピンク' },
  { color: '#E2E8F0', name: '淡いグレー' },
];

// 主要教科の初期カラー
export const DEFAULT_SUBJECT_COLORS: Record<string, string> = {
  国語: '#FECACA', // 淡い赤
  数学: '#BFDBFE', // 淡い青
  算数: '#BFDBFE', // 淡い青（小学生）
  理科: '#BBF7D0', // 淡い緑
  英語: '#E9D5FF', // 淡い紫
  社会: '#FED7AA', // 淡いオレンジ
};

/**
 * 教科の色を返す。ユーザー設定 → 初期カラー → 名前から安定的に選ぶ、の順。
 */
export function subjectColor(subject: string, colors?: Record<string, string>): string {
  if (colors?.[subject]) return colors[subject];
  if (DEFAULT_SUBJECT_COLORS[subject]) return DEFAULT_SUBJECT_COLORS[subject];
  let h = 0;
  for (const ch of subject) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return PASTEL_PALETTE[h % PASTEL_PALETTE.length].color;
}

/** 淡い色を濃くする（文字色・グラフ線用）。amount: 0〜1 */
export function deepen(hex: string, amount = 0.5): string {
  const n = hex.replace('#', '');
  if (n.length !== 6) return '#334155';
  const f = (i: number) => Math.round(parseInt(n.slice(i, i + 2), 16) * (1 - amount));
  const to = (v: number) => v.toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(2))}${to(f(4))}`;
}
