'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type DisplayEntry = {
  id: string;
  user_id: string;
  status: 'applied' | 'contracted';
  created_at: string;
  nickname: string;
};

export default function AdminSpecialEntriesPage() {
  const { specialId } = useParams<{ specialId: string }>();
  const { currentUser, loading: authLoading } = useAuth();
  const [specialTitle, setSpecialTitle] = useState('');
  const [entries, setEntries] = useState<DisplayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!specialId) {
      setError('講座IDが見つかりません。');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Fetch special course title
      const { data: special, error: specialError } = await (supabase.from('specials') as any)
        .select('title')
        .eq('id', specialId)
        .single();

      if (specialError || !special) throw new Error('講座が見つかりません。');
      setSpecialTitle(special.title);

      // Fetch entries for this special
      const { data: entriesData, error: entriesError } = await (supabase.from('entries') as any)
        .select('id, user_id, status, created_at')
        .eq('special_id', specialId)
        .order('created_at', { ascending: false });

      if (entriesError) throw entriesError;

      if (entriesData && entriesData.length > 0) {
        const userIds = [...new Set(entriesData.map((e: any) => e.user_id))];
        const { data: users } = await (supabase.from('users') as any)
          .select('id, nickname')
          .in('id', userIds);

        const usersMap = new Map(
          (users || []).map((u: any) => [u.id, u.nickname || '名前未設定'])
        );

        setEntries(
          entriesData.map((entry: any) => ({
            ...entry,
            nickname: usersMap.get(entry.user_id) || '不明なユーザー',
          }))
        );
      } else {
        setEntries([]);
      }
    } catch (err) {
      console.error('Error fetching entries:', err);
      setError(err instanceof Error ? err.message : 'データ取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [specialId]);

  useEffect(() => {
    if (!authLoading && currentUser) {
      fetchData();
    }
  }, [authLoading, currentUser, fetchData]);

  const handleStatusChange = async (entryId: string, newStatus: 'applied' | 'contracted') => {
    try {
      const supabase = createClient();
      const { error: updateError } = await (supabase.from('entries') as any)
        .update({ status: newStatus })
        .eq('id', entryId);

      if (updateError) throw updateError;

      setEntries((prev) =>
        prev.map((entry) => (entry.id === entryId ? { ...entry, status: newStatus } : entry))
      );
    } catch (err) {
      console.error('Error updating status:', err);
      alert('ステータスの更新に失敗しました。');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-4xl text-center p-8 mx-auto mt-8">
        <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-lg text-center p-8 bg-red-100 dark:bg-red-900/50 rounded-lg mx-auto mt-8">
        <h2 className="text-2xl font-bold text-red-800 dark:text-red-200">エラー</h2>
        <p className="mt-2 text-red-600 dark:text-red-300">{error}</p>
        <Link
          href="/admin/specials"
          className="mt-6 inline-block bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg"
        >
          特別講座一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mx-auto mt-8">
      <div className="flex justify-between items-center mb-6 border-b dark:border-gray-700 pb-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          {specialTitle} - 申込者一覧
        </h1>
        <Link
          href="/admin/specials"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          &larr; 講座一覧に戻る
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                生徒名
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                申込日時
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                ステータス
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {entries.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="text-center py-10 text-gray-500 dark:text-gray-400"
                >
                  申込者はいません。
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {entry.nickname}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(entry.created_at).toLocaleString('ja-JP')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <select
                      value={entry.status}
                      onChange={(e) =>
                        handleStatusChange(entry.id, e.target.value as 'applied' | 'contracted')
                      }
                      className={`p-1 rounded-md text-xs border ${
                        entry.status === 'applied'
                          ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200'
                          : 'bg-green-100 dark:bg-green-900/50 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200'
                      }`}
                    >
                      <option value="applied">申込完了</option>
                      <option value="contracted">契約完了</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
