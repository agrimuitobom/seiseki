# AI模擬問題生成のセットアップ（フェーズ2）

保存した授業プリント（画像・PDF）を **Claude** に読ませて、選択問題＋記述問題を自動生成する機能です。サーバー側の **Cloud Functions** がAPIキーを安全に保持し、Claudeを呼び出します。

```
プリント選択 →「AIで問題をつくる」
   → Cloud Function generateQuiz（asia-northeast1）
   → Storage からファイル取得 → Claude（claude-opus-4-8）が画像/PDFを読解
   → 選択/記述の問題＋解答＋解説をJSONで生成 → quizzes に保存 → アプリで出題
```

> 前提: Firebase は **Blazeプラン**（Cloud Functions に必要）。

---

## 1. Anthropic APIキーを取得

1. [console.anthropic.com](https://console.anthropic.com) でログイン
2. 「API Keys」→ 新しいキーを作成（`sk-ant-...`）

## 2. キーを Functions のシークレットに登録

手元（`seiseki` フォルダ）で：

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
# プロンプトが出たら sk-ant-... を貼り付けて Enter
```

シークレットは Google Secret Manager に保存され、関数の実行時のみ読み込まれます（コードには含まれません）。

## 3. 関数をデプロイ

```bash
cd functions
npm install      # 初回のみ
cd ..
firebase deploy --only functions
```

初回デプロイ時、必要なAPI（Cloud Functions / Cloud Build / Artifact Registry 等）の有効化を求められたら許可してください。完了すると `generateQuiz(asia-northeast1)` がデプロイされます。

## 4. 動作確認

公開サイト（または `npm run dev`）→ プリントタブ → 資料の **「🤖 AIで問題をつくる」** を押す → 数十秒で問題が表示されれば成功です。

---

## 補足・運用

| 項目 | 内容 |
| --- | --- |
| 使用モデル | `claude-opus-4-8`（画像・PDFを直接読解。OCRは別途不要） |
| 出題形式 | 選択（4択, 自動採点）＋記述（模範解答・解説を表示） |
| ファイル上限 | 15MB（それ以上はエラー。圧縮して再アップロード） |
| 保存先 | `quizzes` コレクション（本人のみ読み取り可。作成は関数のみ） |
| コスト | Claude API は従量課金。1回の生成で概ね数円程度（プリント枚数による） |

### CIには含めていません
Cloud Functions の自動デプロイは、シークレット設定や課金APIの都合があるため、当面は**手動デプロイ**（`firebase deploy --only functions`）にしています。GitHub Actions では従来どおり Hosting と Firestore/Storage ルールのみ自動デプロイされます。関数のコードを変えたら、上記 3 を実行してください。

### トラブルシューティング
| 症状 | 対処 |
| --- | --- |
| `unauthenticated` | アプリにログインしているか確認 |
| `failed-precondition` / secret エラー | 手順2のシークレット登録をやり直す |
| デプロイで権限/API有効化エラー | 表示に従い有効化、`firebase login` を確認 |
| 生成が失敗する | ファイルが大きすぎないか、画像/PDFか、APIキーの残高を確認 |
