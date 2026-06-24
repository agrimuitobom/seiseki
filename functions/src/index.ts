import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';

admin.initializeApp();

// Anthropic の APIキー。`firebase functions:secrets:set ANTHROPIC_API_KEY` で設定する。
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Claude に「この形のJSONで返す」と強制するスキーマ（構造化出力）。
const QUIZ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: ['mc', 'written'] },
          question: { type: 'string' },
          // 選択問題は選択肢を入れる。記述問題は空配列 []。
          choices: { type: 'array', items: { type: 'string' } },
          answer: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['type', 'question', 'choices', 'answer', 'explanation'],
      },
    },
  },
  required: ['title', 'questions'],
};

/**
 * 保存済みのプリント（画像 / PDF）を Claude に読ませて模擬問題を生成する。
 * クライアントは materialId と問題数を渡す。APIキーはこの関数内のみで使う。
 */
export const generateQuiz = onCall(
  {
    region: 'asia-northeast1',
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'ログインが必要です。');

    const materialId = String(request.data?.materialId || '');
    const count = Math.min(Math.max(Number(request.data?.count) || 5, 1), 10);
    if (!materialId) throw new HttpsError('invalid-argument', 'materialId が必要です。');

    const db = admin.firestore();
    const snap = await db.collection('materials').doc(materialId).get();
    if (!snap.exists) throw new HttpsError('not-found', '資料が見つかりません。');

    const m = snap.data() as {
      owner: string;
      subject: string;
      fileName: string;
      storagePath: string;
      contentType: string;
    };
    if (m.owner !== uid) {
      throw new HttpsError('permission-denied', 'この資料へのアクセス権がありません。');
    }

    const isPdf = m.contentType === 'application/pdf';
    const isImage = m.contentType.startsWith('image/');
    if (!isPdf && !isImage) {
      throw new HttpsError('invalid-argument', '画像またはPDFのみ対応しています。');
    }

    // Storage からファイルを取得して base64 化
    const [buf] = await admin.storage().bucket().file(m.storagePath).download();
    if (buf.length > 15 * 1024 * 1024) {
      throw new HttpsError('invalid-argument', 'ファイルが大きすぎます（15MB以下にしてください）。');
    }
    const base64 = buf.toString('base64');

    // Claude に渡すファイルブロック（画像 or PDF）
    const fileBlock = isPdf
      ? {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        }
      : {
          type: 'image',
          source: { type: 'base64', media_type: m.contentType, data: base64 },
        };

    const prompt = `あなたは${m.subject}の先生です。添付した授業プリントの内容だけを根拠に、生徒向けの練習問題を${count}問つくってください。
- 選択問題（4択, type:"mc"）と記述問題（type:"written"）を両方ふくめてください。
- すべて日本語で、プリントの範囲に沿った難易度にしてください。
- 各問題に正解(answer)とやさしい解説(explanation)を必ずつけてください。
- mc では choices に4つの選択肢を入れ、answer はその中の正解の選択肢の文字列にしてください。
- written では choices は空配列 [] にし、answer は模範解答にしてください。
- プリントから読み取れない場合は推測せず、読み取れた範囲で作問してください。`;

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    let response;
    try {
      // output_config はSDKの型に無い場合があるため any 経由で渡す。
      response = await anthropic.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 8000,
        output_config: { format: { type: 'json_schema', schema: QUIZ_SCHEMA } },
        messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: prompt }] }],
      } as unknown as Anthropic.MessageCreateParamsNonStreaming);
    } catch (err) {
      console.error('Anthropic API error', err);
      throw new HttpsError('internal', 'AIへのリクエストに失敗しました。時間をおいて再度お試しください。');
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new HttpsError('internal', '問題の生成に失敗しました。');
    }

    let parsed: { title?: string; questions?: unknown[] };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      throw new HttpsError('internal', '生成結果の解析に失敗しました。');
    }

    const quiz = {
      owner: uid,
      materialId,
      subject: m.subject,
      title: parsed.title || `${m.subject}の練習問題`,
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      createdAt: Date.now(),
    };

    const ref = await db.collection('quizzes').add(quiz);
    return { quizId: ref.id, ...quiz };
  },
);
