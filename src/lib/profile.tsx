import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './auth';
import { ensurePublicProfile } from './social';

export type SchoolType = '小' | '中' | '高';

export type CareerGoal = { type: string; target: string; note: string };

export const CAREER_TYPES: { value: string; label: string }[] = [
  { value: 'high_school', label: '高校入試' },
  { value: 'university', label: '大学進学' },
  { value: 'vocational', label: '専門・短大' },
  { value: 'employment', label: '就職' },
];

export type Profile = {
  displayName: string;
  schoolType: SchoolType;
  grade: string;
  subjects: string[];
  careerGoal: CareerGoal | null;
};

export const SCHOOL_TYPES: SchoolType[] = ['小', '中', '高'];
export const SCHOOL_LABELS: Record<SchoolType, string> = {
  小: '小学生',
  中: '中学生',
  高: '高校生',
};

// 学年の選択肢（学校種別ごと）
export const GRADES: Record<SchoolType, string[]> = {
  小: ['1年', '2年', '3年', '4年', '5年', '6年'],
  中: ['1年', '2年', '3年'],
  高: ['1年', '2年', '3年'],
};

// 学校種別ごとの初期科目（編集のベース）
export const DEFAULT_SUBJECTS: Record<SchoolType, string[]> = {
  小: ['国語', '算数', '理科', '社会', '英語'],
  中: ['国語', '数学', '英語', '理科', '社会'],
  高: ['国語', '数学', '英語', '理科', '社会', '情報'],
};

const DEFAULT_PROFILE: Profile = {
  displayName: 'ゲスト',
  schoolType: '中',
  grade: '1年',
  subjects: DEFAULT_SUBJECTS['中'],
  careerGoal: null,
};

type OnboardingData = { displayName: string; schoolType: SchoolType; grade: string };

type ProfileCtx = {
  profile: Profile;
  subjects: string[];
  loading: boolean;
  needsOnboarding: boolean;
  save: (patch: Partial<Profile>) => Promise<void>;
  completeOnboarding: (data: OnboardingData) => Promise<void>;
};

const Ctx = createContext<ProfileCtx>({
  profile: DEFAULT_PROFILE,
  subjects: DEFAULT_PROFILE.subjects,
  loading: true,
  needsOnboarding: false,
  save: async () => {},
  completeOnboarding: async () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const defaultName = user?.email?.split('@')[0] ?? 'ゲスト';
  const [profile, setProfile] = useState<Profile>({ ...DEFAULT_PROFILE, displayName: defaultName });
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    return onSnapshot(ref, (snap) => {
      const d = snap.data();
      if (d) {
        const schoolType: SchoolType = (d.schoolType as SchoolType) ?? DEFAULT_PROFILE.schoolType;
        setProfile({
          displayName: d.displayName ?? defaultName,
          schoolType,
          grade: d.grade ?? GRADES[schoolType][0],
          subjects:
            Array.isArray(d.subjects) && d.subjects.length > 0
              ? d.subjects
              : DEFAULT_SUBJECTS[schoolType],
          careerGoal: (d.careerGoal as CareerGoal) ?? null,
        });
        // 既存ユーザー（学校設定済み）はオンボーディング不要
        setNeedsOnboarding(!(d.onboarded || d.schoolType));
      } else {
        // 新規ユーザー（プロフィール未作成）
        setNeedsOnboarding(true);
      }
      setLoading(false);
    });
  }, [user]);

  // 公開プロフィール（表示名・フレンドコード）を用意/同期
  useEffect(() => {
    if (!user) return;
    ensurePublicProfile(user.uid, profile.displayName).catch(() => {});
  }, [user, profile.displayName]);

  async function save(patch: Partial<Profile>) {
    if (!user) return;
    const next = { ...profile, ...patch };
    await setDoc(
      doc(db, 'users', user.uid),
      { owner: user.uid, ...next, updatedAt: Date.now() },
      { merge: true },
    );
  }

  async function completeOnboarding(data: OnboardingData) {
    if (!user) return;
    await setDoc(
      doc(db, 'users', user.uid),
      {
        owner: user.uid,
        displayName: data.displayName,
        schoolType: data.schoolType,
        grade: data.grade,
        subjects: DEFAULT_SUBJECTS[data.schoolType],
        onboarded: true,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  }

  return (
    <Ctx.Provider
      value={{
        profile,
        subjects: profile.subjects,
        loading,
        needsOnboarding,
        save,
        completeOnboarding,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useProfile = () => useContext(Ctx);
