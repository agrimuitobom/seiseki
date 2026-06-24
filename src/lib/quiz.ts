import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export type QuizQuestion = {
  type: 'mc' | 'written'; // 選択 / 記述
  question: string;
  choices: string[]; // mc のみ。written は []
  answer: string;
  explanation: string;
};

export type Quiz = {
  quizId: string;
  subject: string;
  title: string;
  questions: QuizQuestion[];
};

const callGenerateQuiz = httpsCallable<{ materialId: string; count?: number }, Quiz>(
  functions,
  'generateQuiz',
);

/** 保存済みプリントから AI で模擬問題を生成する（Cloud Function を呼ぶ）。 */
export async function generateQuiz(materialId: string, count = 5): Promise<Quiz> {
  const res = await callGenerateQuiz({ materialId, count });
  return res.data;
}
