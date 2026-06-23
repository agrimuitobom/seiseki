# Seiseki（成績）

小中高生向けの成績管理・学習支援Webアプリの設計書 / 実装ガイド。

> 「自分の弱点がわかる」「友達と楽しく競える」「AIが志望進路に合わせて伴走する」

## コアバリュー

- 📊 成績の可視化・分析（推移グラフ、レーダー、目標管理）
- 🤖 AI答案分析・弱点克服小テスト（OCR + LLM）
- 📝 テスト対策・理解度管理（AI問題生成、進捗ゲージ）
- ⏱️ 学習効率・タスク管理（タイマー、提出物リマインダー）
- 🎯 進路最適化・AIアドバイザー（成績からの逆算アドバイス）
- 👥 ソーシャル（承認制フレンド、フレンド内ランキング）

## ドキュメント

- **[設計書 / 実装ガイド](docs/設計書.md)** — UI/UX、技術スタック、DB設計、ロードマップ

## サンプルコード

スカイブルー・テーマ（角丸16px）のプロトタイプ。

- [`examples/tailwind.config.js`](examples/tailwind.config.js) — デザイントークン
- [`examples/Dashboard.tsx`](examples/Dashboard.tsx) — ダッシュボード（ホーム画面）
- [`examples/GradeChart.tsx`](examples/GradeChart.tsx) — 成績グラフ（重ね合わせ・目標ライン）

依存: `react`, `recharts`, `tailwindcss`

## デザインシステム（スカイブルー・テーマ）

| 用途 | 色 | HEX |
| --- | --- | --- |
| Base（背景・余白） | アイスブルー | `#F0F9FF` |
| Main（ヘッダー・主ボタン・主線） | スカイブルー | `#0EA5E9` |
| Accent（ランキング・通知・重要） | コーラル | `#FF7E5F` |
| Success（達成・正解） | ミント | `#10B981` |

- 角丸基準: `16px` ／ フォント: Noto Sans JP（本文）+ Plus Jakarta Sans（英数字）
