import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { GoogleGenAI, Type } from '@google/genai';

admin.initializeApp();

// Google Gemini の APIキー。`firebase functions:secrets:set GEMINI_API_KEY` で設定する。
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// 進路アドバイスの出力スキーマ
const ADVICE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    steps: { type: Type.ARRAY, items: { type: Type.STRING } },
    subjects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          advice: { type: Type.STRING },
        },
        required: ['subject', 'advice'],
      },
    },
  },
  required: ['summary', 'steps', 'subjects'],
};

// JST の日付文字列 'yyyy-mm-dd'（offsetDays 日後）
function jstDateStr(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * 進路アドバイザー：進路目標＋現在の成績から、目標達成に向けた助言を Gemini で生成。
 */
export const careerAdvice = onCall(
  {
    region: 'asia-northeast1',
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'ログインが必要です。');

    const db = admin.firestore();
    const u = (await db.collection('users').doc(uid).get()).data() ?? {};
    const goal = u.careerGoal as { type?: string; target?: string; note?: string } | undefined;
    if (!goal || !goal.type) {
      throw new HttpsError('failed-precondition', '進路目標を設定してください。');
    }

    const goalLabel =
      ({
        high_school: '高校入試',
        university: '大学進学',
        vocational: '専門・短大',
        employment: '就職',
      } as Record<string, string>)[goal.type] ?? goal.type;

    // 成績サマリ（科目ごとの直近・平均得点率）
    const tr = await db.collection('testResults').where('owner', '==', uid).get();
    const bySubject = new Map<string, { date: string; pct: number }[]>();
    tr.forEach((d) => {
      const r = d.data() as { subject: string; testDate: string; score: number; maxScore: number };
      const pct = r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 100) : 0;
      const arr = bySubject.get(r.subject) ?? [];
      arr.push({ date: r.testDate, pct });
      bySubject.set(r.subject, arr);
    });
    const lines: string[] = [];
    for (const [sub, arr] of bySubject) {
      arr.sort((a, b) => a.date.localeCompare(b.date));
      const latest = arr[arr.length - 1];
      const avg = Math.round(arr.reduce((s, x) => s + x.pct, 0) / arr.length);
      lines.push(`${sub}: 直近${latest.pct}% / 平均${avg}%（${arr.length}回）`);
    }
    const gradesSummary = lines.length ? lines.join('\n') : '（成績データはまだありません）';
    const schoolGrade = `${u.schoolType ?? ''} ${u.grade ?? ''}`.trim();

    const prompt = `あなたは中高生向けの進路指導の先生です。次の生徒に、目標達成に向けて「今やるべきこと」を前向きかつ具体的に助言してください。

# 生徒
- 学年: ${schoolGrade || '不明'}
- 進路目標: ${goalLabel}${goal.target ? `（志望: ${goal.target}）` : ''}
${goal.note ? `- 補足: ${goal.note}` : ''}

# 現在の成績（得点率）
${gradesSummary}

# 出力の方針
- summary: 現状と目標までの見通しを2〜3文で。プレッシャーを与えすぎず、伸びしろを前向きに示す。
- steps: 今日から取り組める具体的な行動を3〜5個。科目名や時間の目安を入れて具体的に。
- subjects: 成績データのある科目について、それぞれ一言アドバイス。弱点科目を優先する。
- すべて日本語、中高生にわかる平易な言葉で。`;

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
    let text: string | undefined;
    try {
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json', responseSchema: ADVICE_SCHEMA },
      });
      text = res.text;
    } catch (err) {
      console.error('careerAdvice Gemini error', err);
      throw new HttpsError('internal', 'AIへのリクエストに失敗しました。時間をおいて再度お試しください。');
    }
    if (!text) throw new HttpsError('internal', 'アドバイスの生成に失敗しました。');

    let parsed: { summary?: string; steps?: unknown[]; subjects?: unknown[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new HttpsError('internal', '生成結果の解析に失敗しました。');
    }

    const advice = {
      summary: parsed.summary ?? '',
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      goalLabel,
      createdAt: Date.now(),
    };
    await db.collection('careerAdvice').doc(uid).set(advice);
    return advice;
  },
);

/**
 * 毎日18:00(JST)に、期限が「今日/明日」の未完了提出物を持つユーザーへ
 * プッシュ通知を送る。
 */
export const remindAssignments = onSchedule(
  { schedule: '0 18 * * *', timeZone: 'Asia/Tokyo', region: 'asia-northeast1' },
  async () => {
    const db = admin.firestore();
    const today = jstDateStr(0);
    const tomorrow = jstDateStr(1);

    const snap = await db.collection('assignments').where('done', '==', false).get();

    // ユーザーごとに期限間近の提出物を集計
    const byOwner = new Map<string, { title: string; when: string }[]>();
    snap.forEach((doc) => {
      const a = doc.data() as { owner: string; title: string; dueDate: string };
      const when = a.dueDate === today ? '今日' : a.dueDate === tomorrow ? '明日' : null;
      if (!when) return;
      const list = byOwner.get(a.owner) ?? [];
      list.push({ title: a.title, when });
      byOwner.set(a.owner, list);
    });

    for (const [owner, items] of byOwner) {
      const tokensSnap = await db.collection('fcmTokens').where('owner', '==', owner).get();
      const tokens = tokensSnap.docs.map((d) => d.id);
      if (tokens.length === 0) continue;

      const body =
        items.length === 1
          ? `「${items[0].title}」が${items[0].when}まで！`
          : `提出物が${items.length}件、期限が近づいています`;

      const res = await admin.messaging().sendEachForMulticast({
        tokens,
        data: { title: '提出物リマインド 📌', body },
      });

      // 無効になったトークンを掃除
      res.responses.forEach((r, i) => {
        if (
          !r.success &&
          (r.error?.code === 'messaging/registration-token-not-registered' ||
            r.error?.code === 'messaging/invalid-registration-token')
        ) {
          void db.collection('fcmTokens').doc(tokens[i]).delete();
        }
      });
    }
  },
);

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
    const difficulty = ['easy', 'normal', 'hard'].includes(request.data?.difficulty)
      ? (request.data.difficulty as 'easy' | 'normal' | 'hard')
      : 'normal';
    const format = ['mc', 'written', 'both'].includes(request.data?.format)
      ? (request.data.format as 'mc' | 'written' | 'both')
      : 'both';
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

    const difficultyText = {
      easy: 'やさしめ（基礎・用語の確認レベル）',
      normal: 'ふつう（教科書の標準レベル）',
      hard: 'むずかしめ（応用・発展、入試レベル）',
    }[difficulty];

    const formatText = {
      mc: '選択問題（4択, type:"mc"）のみ',
      written: '記述問題（type:"written"）のみ',
      both: '選択問題（4択, type:"mc"）と記述問題（type:"written"）を両方',
    }[format];

    const prompt = `あなたは${m.subject}の先生です。添付した授業プリントを参考に、同じ単元の練習問題を${count}問つくってください。
難易度は「${difficultyText}」にそろえてください。
出題形式は ${formatText} で作ってください。

【最重要】生徒は「問題文」しか見られません（プリントや図は見られません）。必ず問題文だけで解けるように作ってください。
- 「図」「グラフ」「表」「下の」「上の」「次の」「プリントの」などの参照表現は使わないでください。
- 図や数値が必要な問題は、辺の長さ・角度・座標・数値などの条件を **すべて文章の中** に書いてください（例:「AB=5、角A=60°の三角形で BC の長さを求めなさい」）。
- プリントの図そのものを前提にした問題は出さず、条件を文章にした自己完結した新しい問題に作り変えてください。

その他のルール:
- すべて日本語で作ってください。
- 各問題に正解(answer)とやさしい解説(explanation)を必ずつけてください。
- mc では choices に4つの選択肢を入れ、answer はその中の正解の選択肢の文字列にしてください。
- written では choices は空配列 [] にし、answer は模範解答にしてください。`;

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
