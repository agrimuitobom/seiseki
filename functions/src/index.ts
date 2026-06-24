import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { GoogleGenAI, Type } from '@google/genai';

admin.initializeApp();

// Google Gemini の APIキー。`firebase functions:secrets:set GEMINI_API_KEY` で設定する。
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// Gemini に「この形のJSONで返す」と強制するスキーマ（構造化出力）。
const QUIZ_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ['mc', 'written'] },
          question: { type: Type.STRING },
          // 選択問題は選択肢を入れる。記述問題は空配列 []。
          choices: { type: Type.ARRAY, items: { type: Type.STRING } },
          answer: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: ['type', 'question', 'choices', 'answer', 'explanation'],
      },
    },
  },
  required: ['title', 'questions'],
};

/**
 * 保存済みのプリント（画像 / PDF）を Gemini に読ませて模擬問題を生成する。
 * クライアントは materialId と問題数を渡す。APIキーはこの関数内のみで使う。
 */
export const generateQuiz = onCall(
  {
    region: 'asia-northeast1',
    secrets: [GEMINI_API_KEY],
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

    const prompt = `あなたは${m.subject}の先生です。添付した授業プリントの内容だけを根拠に、生徒向けの練習問題を${count}問つくってください。
- 選択問題（4択, type:"mc"）と記述問題（type:"written"）を両方ふくめてください。
- すべて日本語で、プリントの範囲に沿った難易度にしてください。
- 各問題に正解(answer)とやさしい解説(explanation)を必ずつけてください。
- mc では choices に4つの選択肢を入れ、answer はその中の正解の選択肢の文字列にしてください。
- written では choices は空配列 [] にし、answer は模範解答にしてください。
- プリントから読み取れない場合は推測せず、読み取れた範囲で作問してください。`;

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });

    let text: string | undefined;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: m.contentType, data: base64 } },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: QUIZ_SCHEMA,
        },
      });
      text = response.text;
    } catch (err) {
      console.error('Gemini API error', err);
      throw new HttpsError('internal', 'AIへのリクエストに失敗しました。時間をおいて再度お試しください。');
    }

    if (!text) {
      throw new HttpsError('internal', '問題の生成に失敗しました。');
    }

    let parsed: { title?: string; questions?: unknown[] };
    try {
      parsed = JSON.parse(text);
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
