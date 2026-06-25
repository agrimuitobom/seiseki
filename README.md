# Seiseki（成績）

小中高生向けの成績管理・学習支援Webアプリ。React + Vite + Tailwind CSS、バックエンドは Firebase。

> 「自分の弱点がわかる」「友達と楽しく競える」「AIが志望進路に合わせて伴走する」

## コアバリュー

- 📊 成績の可視化・分析（推移グラフ、レーダー、目標管理）
- 🤖 AI答案分析・弱点克服小テスト（OCR + LLM）
- 📝 テスト対策・理解度管理（AI問題生成、進捗ゲージ）
- ⏱️ 学習効率・タスク管理（タイマー、提出物リマインダー）
- 🎯 進路最適化・AIアドバイザー（成績からの逆算アドバイス）
- 👥 ソーシャル（承認制フレンド、フレンド内ランキング）

## 技術スタック

| 用途 | 技術 |
| --- | --- |
| フロント | React 18 + Vite + TypeScript + Tailwind CSS |
| グラフ | Recharts |
| 認証 | Firebase Authentication |
| DB | Cloud Firestore |
| 画像保存（答案） | Firebase Cloud Storage |
| 公開（ホスティング） | Firebase Hosting |

## ローカルで動かす

```bash
npm install
cp .env.example .env.local   # Firebase の設定値を記入
npm run dev                  # http://localhost:5173
```

`.env.local` の値は Firebase コンソール → プロジェクト設定 → 「マイアプリ」から取得します。

## Firebase にデプロイ

```bash
# 1. Firebase CLI（未インストールなら）
npm install -g firebase-tools

# 2. Google アカウントでログイン
firebase login

# 3. .firebaserc の "your-project-id" を実際のプロジェクトIDに書き換える
#    （または `firebase use --add` で対話的に選択）

# 4. ビルドして公開（build + firebase deploy をまとめて実行）
npm run deploy
```

公開後 `https://<project-id>.web.app` でアクセスできます。詳しい手順は [docs/デプロイ手順.md](docs/デプロイ手順.md) を参照。

## 実装済み機能（MVP コア）

- 🔐 ログイン / 新規登録（メール＋パスワード, Firebase Authentication）
- ✍️ 成績の入力 → Firestore に保存（本人のみアクセス可能）
- 📈 科目別の成績推移グラフ（得点率・目標ライン）／記録一覧・削除

## 主なファイル

- [`src/components/Login.tsx`](src/components/Login.tsx) — ログイン / 新規登録画面
- [`src/components/Dashboard.tsx`](src/components/Dashboard.tsx) — ダッシュボード（ホーム画面）
- [`src/components/GradeForm.tsx`](src/components/GradeForm.tsx) — 成績入力フォーム
- [`src/components/GradeChart.tsx`](src/components/GradeChart.tsx) — 成績グラフ（得点率・目標ライン）
- [`src/lib/firebase.ts`](src/lib/firebase.ts) — Firebase 初期化（Auth / Firestore / Storage）
- [`src/lib/auth.tsx`](src/lib/auth.tsx) — 認証状態の管理（AuthProvider / useAuth）
- [`src/lib/grades.ts`](src/lib/grades.ts) — テスト結果の保存・購読・削除（Firestore）
- [`tailwind.config.js`](tailwind.config.js) — スカイブルー・テーマのデザイントークン
- [`firebase.json`](firebase.json) / [`firestore.rules`](firestore.rules) / [`storage.rules`](storage.rules) — Firebase 設定とセキュリティルール

## ドキュメント

- **[設計書 / 実装ガイド](docs/設計書.md)** — UI/UX、技術スタック、DB設計、ロードマップ
- **[デプロイ手順](docs/デプロイ手順.md)** — Firebase 公開の詳細ステップ
- **[自動デプロイ設定](docs/自動デプロイ設定.md)** — GitHub Actions で main マージ時に自動デプロイ
- **[AI問題生成セットアップ](docs/AI問題生成セットアップ.md)** — Cloud Functions + Gemini で模擬問題を生成
- **[プッシュ通知セットアップ](docs/プッシュ通知セットアップ.md)** — FCM で提出物リマインドを端末に通知

## デザインシステム（スカイブルー・テーマ）

| 用途 | 色 | HEX |
| --- | --- | --- |
| Base（背景・余白） | アイスブルー | `#F0F9FF` |
| Main（ヘッダー・主ボタン・主線） | スカイブルー | `#0EA5E9` |
| Accent（ランキング・通知・重要） | コーラル | `#FF7E5F` |
| Success（達成・正解） | ミント | `#10B981` |

- 角丸基準: `16px` ／ フォント: Noto Sans JP（本文）+ Plus Jakarta Sans（英数字）
