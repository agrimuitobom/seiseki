/** Seiseki デザイントークン（スカイブルー・テーマ） */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', './examples/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#F0F9FF', // アイスブルー（背景・余白）
        main: '#0EA5E9', // スカイブルー（ヘッダー・主要ボタン・グラフ主線）
        accent: '#FF7E5F', // コーラル（ランキング・通知・重要アクション）
        success: '#10B981', // ミント（目標達成・正解表示）
      },
      borderRadius: {
        card: '16px', // 親しみやすいカードの角丸基準
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '"Noto Sans JP"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 8px 24px -8px rgba(14,165,233,0.25)',
      },
    },
  },
  plugins: [],
};
