import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { fmtDuration } from '../lib/study';
import {
  watchFriendships,
  getPublicProfile,
  findByFriendCode,
  sendFriendRequest,
  acceptFriendship,
  removeFriendship,
  weekKey,
  type Friendship,
  type PublicProfile,
} from '../lib/social';

export default function Friends() {
  const { user } = useAuth();
  const me = user?.uid ?? '';

  const [myProfile, setMyProfile] = useState<PublicProfile | null>(null);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me) return;
    getPublicProfile(me).then(setMyProfile);
    return watchFriendships(me, setFriendships);
  }, [me]);

  // 関わる全ユーザーの公開プロフィールを取得
  useEffect(() => {
    const uids = new Set<string>([me]);
    friendships.forEach((f) => {
      uids.add(f.requester);
      uids.add(f.addressee);
    });
    Promise.all(
      [...uids].map(async (uid) => [uid, await getPublicProfile(uid)] as const),
    ).then((pairs) => {
      const map: Record<string, PublicProfile> = {};
      pairs.forEach(([uid, p]) => {
        if (p) map[uid] = p;
      });
      setProfiles(map);
    });
  }, [friendships, me]);

  const accepted = friendships.filter((f) => f.status === 'accepted');
  const incoming = friendships.filter((f) => f.status === 'pending' && f.addressee === me);
  const outgoing = friendships.filter((f) => f.status === 'pending' && f.requester === me);

  // ランキング（自分＋承認済みフレンド）の今週の勉強時間
  const ranking = useMemo(() => {
    const uids = new Set<string>([me]);
    accepted.forEach((f) => uids.add(f.requester === me ? f.addressee : f.requester));
    const wk = weekKey();
    return [...uids]
      .map((uid) => ({
        uid,
        name: profiles[uid]?.displayName ?? '（読み込み中）',
        sec: profiles[uid]?.weekly?.[wk] ?? 0,
      }))
      .sort((a, b) => b.sec - a.sec);
  }, [accepted, profiles, me]);

  const friendOf = (f: Friendship) => (f.requester === me ? f.addressee : f.requester);

  async function handleAdd() {
    const c = code.trim().toUpperCase();
    setMsg(null);
    if (!c) return;
    if (c === myProfile?.friendCode) {
      setMsg('自分のコードは追加できません。');
      return;
    }
    setBusy(true);
    try {
      const found = await findByFriendCode(c);
      if (!found) {
        setMsg('そのコードのユーザーが見つかりません。');
        return;
      }
      const already = friendships.some(
        (f) => f.requester === found.uid || f.addressee === found.uid,
      );
      if (already) {
        setMsg('すでに申請済み、またはフレンドです。');
        return;
      }
      await sendFriendRequest(me, found.uid);
      setMsg(`${found.displayName} さんに申請を送りました。`);
      setCode('');
    } catch {
      setMsg('申請に失敗しました。');
    } finally {
      setBusy(false);
    }
  }

  const medal = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-screen bg-base font-sans text-slate-800">
      <header className="rounded-b-[28px] bg-gradient-to-br from-main to-sky-400 px-5 pb-8 pt-6 text-white">
        <p className="text-sm/relaxed opacity-90">フレンド</p>
        <h1 className="font-display text-xl font-bold">いっしょにがんばろう 👥</h1>
      </header>

      <main className="mx-auto -mt-5 max-w-md space-y-4 px-4 pb-28">
        {/* 自分のコード & 追加 */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <p className="text-xs font-bold text-slate-500">あなたのフレンドコード</p>
          <div className="mb-3 mt-1 flex items-center gap-2">
            <span className="font-display text-2xl font-bold tracking-widest text-main">
              {myProfile?.friendCode ?? '------'}
            </span>
            {myProfile?.friendCode && (
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(myProfile.friendCode);
                  setMsg('コードをコピーしました。');
                }}
                className="rounded-full bg-sky-100 px-2 py-1 text-xs font-bold text-main"
              >
                コピー
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="フレンドのコードを入力"
              className="flex-1 rounded-[12px] border border-slate-200 px-3 py-2.5 text-sm uppercase outline-none focus:border-main focus:ring-2 focus:ring-main/20"
            />
            <button
              onClick={handleAdd}
              disabled={busy}
              className="rounded-[12px] bg-main px-4 text-sm font-bold text-white transition active:scale-95 disabled:opacity-50"
            >
              申請
            </button>
          </div>
          {msg && <p className="mt-2 text-xs font-bold text-main">{msg}</p>}
        </section>

        {/* 受信した申請 */}
        {incoming.length > 0 && (
          <section className="rounded-card bg-white p-4 shadow-card">
            <h2 className="mb-2 font-display text-sm font-bold">届いた申請</h2>
            <ul className="space-y-2">
              {incoming.map((f) => (
                <li key={f.id} className="flex items-center justify-between text-sm">
                  <span className="font-bold">{profiles[friendOf(f)]?.displayName ?? '…'}</span>
                  <span className="flex gap-2">
                    <button
                      onClick={() => acceptFriendship(f.id)}
                      className="rounded-full bg-success px-3 py-1 text-xs font-bold text-white"
                    >
                      承認
                    </button>
                    <button
                      onClick={() => removeFriendship(f.id)}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500"
                    >
                      拒否
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ランキング */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-1 font-display text-sm font-bold">今週の勉強時間ランキング</h2>
          <p className="mb-2 text-xs text-slate-400">あなた＋フレンド・月曜始まり</p>
          <ul className="divide-y divide-slate-100">
            {ranking.map((r, i) => (
              <li
                key={r.uid}
                className={`flex items-center gap-3 py-2.5 text-sm ${
                  r.uid === me ? 'rounded-[12px] bg-sky-50 px-2' : ''
                }`}
              >
                <span className="w-7 text-center text-base font-bold">
                  {medal[i] ?? <span className="text-slate-400">{i + 1}</span>}
                </span>
                <span className="flex-1 font-bold text-slate-700">
                  {r.name}
                  {r.uid === me && <span className="ml-1 text-xs text-main">(あなた)</span>}
                </span>
                <span className="font-display font-bold text-main">{fmtDuration(r.sec)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* フレンド一覧 */}
        {accepted.length > 0 && (
          <section className="rounded-card bg-white p-4 shadow-card">
            <h2 className="mb-2 font-display text-sm font-bold">フレンド（{accepted.length}）</h2>
            <ul className="divide-y divide-slate-100">
              {accepted.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-bold text-slate-700">
                    {profiles[friendOf(f)]?.displayName ?? '…'}
                  </span>
                  <button
                    onClick={() => removeFriendship(f.id)}
                    className="text-xs text-slate-300 hover:text-accent"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 送信中の申請 */}
        {outgoing.length > 0 && (
          <p className="px-2 text-center text-xs text-slate-400">
            申請中：{outgoing.length}件（相手の承認待ち）
          </p>
        )}
      </main>
    </div>
  );
}
