'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

type SpecialEntry = {
  id: string;
  special_id: string;
  status: string;
  created_at: string;
  title: string;
};

type PersonalEntry = {
  id: string;
  status: string;
  subject: string;
  notes: string | null;
};

const specialStatusMap: { [key: string]: { text: string; style: string } } = {
  applied: { text: '申込完了', style: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
  contracted: { text: '契約中', style: 'bg-success-200 text-success-800 dark:bg-success-700 dark:text-success-100' },
};

const personalStatusMap: { [key: string]: string } = {
  applied: '申込完了・審査中',
  contracted: '契約中',
  pending_addition: '追加科目 申請中',
};

export default function ApplicationsPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [specialEntries, setSpecialEntries] = useState<SpecialEntry[]>([]);
  const [personalEntries, setPersonalEntries] = useState<PersonalEntry[]>([]);
  const [subjectsMap, setSubjectsMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch subjects master data
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('id, name');
      const sMap = new Map<string, string>();
      subjectsData?.forEach((s: any) => sMap.set(s.id, s.name));
      setSubjectsMap(sMap);

      // Fetch special course entries with joined specials
      const { data: entriesData } = await supabase
        .from('entries')
        .select('id, special_id, status, created_at, specials(id, title)')
        .eq('user_id', currentUser.id) as { data: any[] | null };

      if (entriesData && entriesData.length > 0) {
        const fullEntries: SpecialEntry[] = entriesData.map((e: any) => ({
          id: e.id,
          special_id: e.special_id,
          status: e.status,
          created_at: e.created_at,
          title: e.specials?.title || '不明な講座',
        }));
        setSpecialEntries(fullEntries);
      } else {
        setSpecialEntries([]);
      }

      // Fetch personal lecture entries
      const { data: personalData } = await supabase
        .from('personal_entries')
        .select('id, status, subject, notes')
        .eq('user_id', currentUser.id) as { data: any[] | null };

      if (personalData && personalData.length > 0) {
        setPersonalEntries(personalData as PersonalEntry[]);
      } else {
        setPersonalEntries([]);
      }
    } catch (err) {
      console.error('Failed to fetch application data:', err);
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [currentUser, supabase]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [authLoading, currentUser, router, fetchData]);

  const formatSubject = (subjectKey: string): string => {
    const undecidedMap: { [key: string]: string } = { undecided: '未定' };
    return subjectsMap.get(subjectKey) || undecidedMap[subjectKey] || subjectKey;
  };

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-4xl text-center p-8 animate-fade-in mt-8">
        <div className="spinner mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-300 mt-4">申込状況を読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-lg text-center p-8 bg-danger-100 dark:bg-danger-900/50 rounded-btn animate-fade-in mt-8">
        <h2 className="text-2xl font-bold text-danger-800 dark:text-danger-200">エラー</h2>
        <p className="mt-2 text-danger-600 dark:text-danger-300">{error}</p>
        <Link href="/mypage" className="btn-danger mt-6 inline-block">
          マイページに戻る
        </Link>
      </div>
    );
  }

  // Use the first personal entry as the "main" one (matching old app behavior)
  const personalEntry = personalEntries.length > 0 ? personalEntries[0] : null;

  return (
    <div className="w-full max-w-4xl card p-8 animate-fade-in mt-8">
      <div className="flex justify-between items-center mb-8 border-b dark:border-gray-800 pb-4">
        <h1 className="text-2xl font-bold text-gray-700 dark:text-gray-100 tracking-wider">申込状況</h1>
        <Link href="/mypage" className="text-sm text-primary-600 dark:text-gray-400 hover:underline">&larr; マイページに戻る</Link>
      </div>

      <div className="space-y-10">
        {/* Special Courses Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">特別講習</h2>
          <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-btn shadow-md">
            {specialEntries.length > 0 ? (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {specialEntries.map(entry => {
                  const statusInfo = specialStatusMap[entry.status] || { text: entry.status, style: 'bg-gray-200 text-gray-800' };
                  return (
                    <li key={entry.id} className="py-4 flex flex-col sm:flex-row justify-between sm:items-center">
                      <div>
                        <Link href={`/specials/${entry.special_id}`} className="text-lg font-semibold text-primary-600 hover:underline dark:text-gray-400">{entry.title}</Link>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">申込日: {new Date(entry.created_at).toLocaleDateString('ja-JP')}</p>
                      </div>
                      <div className="mt-2 sm:mt-0">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-badge ${statusInfo.style}`}>
                          {statusInfo.text}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">現在、申し込み済みの特別講習はありません。</p>
            )}
            <Link href="/specials" className="inline-block mt-6 text-sm font-semibold text-primary-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300">
              特別講習一覧へ &rarr;
            </Link>
          </div>
        </div>

        {/* Personal Lectures Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">個別講義</h2>
          <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-btn shadow-md">
            {personalEntry ? (
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">現在のステータス</p>
                <p className="mt-1 text-xl font-bold text-gray-800 dark:text-gray-100">{personalStatusMap[personalEntry.status] || personalEntry.status}</p>

                {personalEntry.status === 'contracted' && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">契約中の科目</p>
                    <p className="mt-1 text-gray-800 dark:text-gray-200">{formatSubject(personalEntry.subject)}</p>
                  </div>
                )}

                {personalEntry.status === 'applied' && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">初回希望科目</p>
                    <p className="mt-1 text-gray-800 dark:text-gray-200">{formatSubject(personalEntry.subject)}</p>
                  </div>
                )}

                <Link href="/personal-entry" className="inline-block mt-6 text-sm font-semibold text-primary-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300">
                  申請内容の確認・追加申請へ &rarr;
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">個別講義はまだ申し込んでいません。</p>
                <Link href="/personal-entry" className="inline-block text-sm font-semibold text-primary-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300">
                  個別講義を申し込む &rarr;
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
