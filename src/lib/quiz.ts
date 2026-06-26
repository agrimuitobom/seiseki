import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export type QuizQuestion = {
  type: 'mc' | 'written'; // 選択 / 記述
  question: string;
  choices: string[]; // mc のみ。written は []
  answer: string;
  explanation: string;
  id?: string; // 弱点ノートからの再出題時、wrongAnswers のドキュメントID
};

export type Quiz = {
  quizId: string;
  subject: string;
  title: string;
  questions: QuizQuestion[];
};

export type Difficulty = 'easy' | 'normal' | 'hard';
export type QuizFormat = 'mc' | 'written' | 'both';
export type GenerateOptions = { count: number; difficulty: Difficulty; format: QuizFormat };

const callGenerateQuiz = httpsCallable<
  { materialId: string; count: number; difficulty: Difficulty; format: QuizFormat },
  Quiz
>(functions, 'generateQuiz');

/** 保存済みプリントから AI で模擬問題を生成する（Cloud Function を呼ぶ）。 */
export async function generateQuiz(materialId: string, opts: GenerateOptions): Promise<Quiz> {
  const res = await callGenerateQuiz({ materialId, ...opts });
  return res.data;
}
