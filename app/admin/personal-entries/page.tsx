'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type PersonalEntry = {
  id: string;
  user_id: string;
  subject: string;
  preferred_date: string;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type DisplayEntry = PersonalEntry & {
  nickname: string;
};

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

const formatStatus = (
  status: string
): { text: string; style: string } => {
  switch (status) {
    case 'pending':
      return {
        text: '申込完了',
        style: 'bg-blue-200 text-blue-800 dark:bg-blue-700 dark:text-blue-100',
      };
    case 'approved':
      return {
        text: '承認済み',
        style: 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100',
      };
    case 'rejected':
      return {
        text: '却下',
        style: 'bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-100',
      };
    default:
      return { text: status, style: 'bg-gray-200 text-gray-800' };
  }
};

export default function AdminPersonalEntriesPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const [allEntries, setAllEntries] = useState<DisplayEntry[]>([]);
  const [subjectsMap, setSubjectsMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DisplayEntry | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Fetch entries and subjects in parallel
      const [entriesResult, subjectsResult] = await Promise.all([
        (supabase.from('personal_entries') as any)
          .select('*')
          .order('created_at', { ascending: false }),
        (supabase.from('subjects') as any).select('id, name'),
      ]);

      if (entriesResult.error) throw entriesResult.error;

      const sMap = new Map<string, string>();
      (subjectsResult.data || []).forEach((s: any) => sMap.set(s.id, s.name));
      setSubjectsMap(sMap);

      const fetchedEntries: PersonalEntry[] = entriesResult.data || [];

      if (fetchedEntries.length > 0) {
        const userIds = [...new Set(fetchedEntries.map((e) => e.user_id))];
        const { data: users } = await (supabase.from('users') as any)
          .select('id, nickname')
          .in('id', userIds);

        const usersMap = new Map<string, string>(
          (users || []).map((u: any) => [u.id, u.nickname || '名前未設定'])
        );

        setAllEntries(
          fetchedEntries.map((entry) => ({
            ...entry,
            nickname: (usersMap.get(entry.user_id) || '不明なユーザー') as string,
          }))
        );
      } else {
        setAllEntries([]);
      }
    } catch (err) {
      console.error('Error fetching personal entries:', err);
      setError(err instanceof Error ? err.message : 'データ取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && currentUser) {
      fetchData();
    }
  }, [authLoading, currentUser, fetchData]);

  const formatSubject = useCallback(
    (subjectKey: string): string => {
      return subjectsMap.get(subjectKey) || subjectKey;
    },
    [subjectsMap]
  );

  const handleOpenModal = (entry: DisplayEntry) => {
    setEditingEntry(entry);
    setNewStatus(entry.status === 'pending' ? 'approved' : entry.status);
    setIsModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!editingEntry) return;
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await (supabase.from('personal_entries') as any)
        .update({ status: newStatus })
        .eq('id', editingEntry.id);

      if (updateError) throw updateError;

      setIsModalOpen(false);
      setEditingEntry(null);
      fetchData();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('ステータスの更新に失敗しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!window.confirm('この申込を削除してもよろしいですか？')) return;
    try {
      const supabase = createClient();
      const { error: deleteError } = await (supabase.from('personal_entries') as any)
        .delete()
        .eq('id', entryId);
      if (deleteError) throw deleteError;
      fetchData();
    } catch (err) {
      console.error('Error deleting entry:', err);
      alert('削除に失敗しました。');
    }
  };

  const filteredEntries = allEntries.filter((entry) => {
    if (filter === 'all') return true;
    return entry.status === filter;
  });

  const filterButtonStyle = (buttonFilter: FilterStatus) =>
    `px-4 py-2 text-sm font-medium rounded-md transition ${
      filter === buttonFilter
        ? 'bg-lime-600 text-white'
        : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
    }`;

  if (authLoading || loading) {
    return (
      <div className="w-full text-center p-8">
        <div className="w-12 h-12 border-4 border-lime-500 border-dashed rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full text-center p-8 bg-red-100 dark:bg-red-900/50 rounded-lg max-w-lg mx-auto mt-8">
        <h2 className="text-xl font-bold text-red-800 dark:text-red-200">エラー</h2>
        <p className="mt-2 text-red-600 dark:text-red-300">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-5xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mx-auto mt-8">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 border-b dark:border-gray-700 pb-4 gap-4">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">個別講義管理</h1>
          <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
            <button onClick={() => setFilter('all')} className={filterButtonStyle('all')}>
              すべて
            </button>
            <button onClick={() => setFilter('pending')} className={filterButtonStyle('pending')}>
              申込完了
            </button>
            <button onClick={() => setFilter('approved')} className={filterButtonStyle('approved')}>
              承認済み
            </button>
            <button onClick={() => setFilter('rejected')} className={filterButtonStyle('rejected')}>
              却下
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
              {filter === 'all' ? '申込者はまだいません。' : '該当する申込者はいません。'}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredEntries.map((entry) => (
                <div key={entry.id}>
                  <div
                    onClick={() =>
                      setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id)
                    }
                    className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-colors"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">
                      {entry.nickname}
                    </span>
                    <div className="flex items-center gap-4 self-end sm:self-center">
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${formatStatus(entry.status).style}`}
                      >
                        {formatStatus(entry.status).text}
                      </span>
                      {entry.status === 'pending' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModal(entry);
                          }}
                          className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
                        >
                          承認へ
                        </button>
                      )}
                      {entry.status === 'approved' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModal(entry);
                          }}
                          className="px-3 py-1 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600"
                        >
                          編集
                        </button>
                      )}
                      <svg
                        className={`w-5 h-5 text-gray-500 transform transition-transform ${expandedEntryId === entry.id ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                  {expandedEntryId === entry.id && (
                    <div className="bg-gray-100 dark:bg-gray-900 p-4">
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm">
                          <dt className="font-semibold text-gray-600 dark:text-gray-300">
                            希望科目
                          </dt>
                          <dd className="text-gray-800 dark:text-gray-100 mt-1">
                            {formatSubject(entry.subject)}
                          </dd>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm">
                          <dt className="font-semibold text-gray-600 dark:text-gray-300">
                            希望日時
                          </dt>
                          <dd className="text-gray-800 dark:text-gray-100 mt-1">
                            {new Date(entry.preferred_date).toLocaleString('ja-JP')}
                          </dd>
                        </div>
                        {entry.notes && (
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm">
                            <dt className="font-semibold text-gray-600 dark:text-gray-300">
                              備考
                            </dt>
                            <dd className="text-gray-800 dark:text-gray-100 mt-1">
                              {entry.notes}
                            </dd>
                          </div>
                        )}
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm">
                          <dt className="font-semibold text-gray-600 dark:text-gray-300">
                            申込日時
                          </dt>
                          <dd className="text-gray-800 dark:text-gray-100 mt-1">
                            {new Date(entry.created_at).toLocaleString('ja-JP')}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && editingEntry && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
              ステータスの変更
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              生徒: {editingEntry.nickname}
            </p>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                ステータス
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-gray-900 dark:text-white"
              >
                <option value="pending">申込完了</option>
                <option value="approved">承認済み</option>
                <option value="rejected">却下</option>
              </select>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={() => handleDeleteEntry(editingEntry.id)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200 rounded-md text-sm hover:bg-red-200"
              >
                削除
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-500 rounded-md text-sm"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleUpdateStatus}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:bg-gray-400"
                >
                  {isSubmitting ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
