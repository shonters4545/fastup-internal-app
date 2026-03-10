'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type UnpaidStudent = {
  userId: string;
  displayName: string;
  email: string;
  parentEmail: string | null;
  paymentMethod: string | null;
  contractStatus: string;
  periodEnd: string;
  daysOverdue: number;
};

export default function AdminUnpaidPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<UnpaidStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const now = new Date().toISOString();

      // Fetch contracts where period has ended or is about to end
      const { data: contractsData, error: contractsError } = await (supabase.from('contracts') as any)
        .select('id, user_id, parent_email, payment_method, status, current_period_end, cancel_at_period_end')
        .eq('status', 'active')
        .lt('current_period_end', now);

      if (contractsError) throw contractsError;

      if (!contractsData || contractsData.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // Get user details
      const userIds = contractsData.map((c: any) => c.user_id);
      const { data: usersData, error: usersError } = await (supabase.from('users') as any)
        .select('id, display_name, email')
        .in('id', userIds);
      if (usersError) throw usersError;

      const usersMap = new Map<string, any>((usersData || []).map((u: any) => [u.id, u]));
      const nowDate = new Date();

      const unpaidList: UnpaidStudent[] = contractsData.map((contract: any) => {
        const user = usersMap.get(contract.user_id);
        const periodEnd = new Date(contract.current_period_end);
        const diffMs = nowDate.getTime() - periodEnd.getTime();
        const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        return {
          userId: contract.user_id,
          displayName: user?.display_name || '（不明）',
          email: user?.email || '',
          parentEmail: contract.parent_email,
          paymentMethod: contract.payment_method,
          contractStatus: contract.status,
          periodEnd: contract.current_period_end,
          daysOverdue,
        };
      });

      // Sort by days overdue descending
      unpaidList.sort((a, b) => b.daysOverdue - a.daysOverdue);
      setStudents(unpaidList);
    } catch (err) {
      console.error('Error fetching unpaid data:', err);
      setError('データの取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-4xl text-center p-8 animate-fade-in mt-8">
        <div className="w-12 h-12 border-4 border-red-500 border-dashed rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-500 dark:text-gray-400 mt-4">読み込み中...</p>
      </div>
    );
  }

  if (!authLoading && currentUser && !['admin', 'super'].includes(currentUser.role)) {
    router.push('/');
    return null;
  }

  return (
    <div className="w-full max-w-6xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 animate-fade-in mt-8">
      <div className="flex justify-between items-center mb-6 border-b dark:border-gray-700 pb-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">未払い管理</h1>
        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
          該当者: {students.length}名
        </span>
      </div>

      {error && <div className="text-center text-red-500 py-4 mb-4">{error}</div>}

      {students.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <div className="text-4xl mb-4">&#10003;</div>
          <p className="text-gray-600 dark:text-gray-400 text-lg font-semibold">未払い・期限切れの生徒はいません</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">全ての契約が有効期間内です。</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">生徒名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">メール</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">保護者メール</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">支払方法</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">期限</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">超過日数</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {students.map((student) => (
                <tr key={student.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/admin/student/${student.userId}`} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                      {student.displayName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{student.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{student.parentEmail || '未設定'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{student.paymentMethod || '未設定'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(student.periodEnd).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      student.daysOverdue > 30
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                        : student.daysOverdue > 7
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                          : 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
                    }`}>
                      {student.daysOverdue}日超過
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
