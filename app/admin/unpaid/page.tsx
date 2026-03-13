'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type UnpaidStudent = {
  userId: string;
  contractId: string;
  displayName: string;
  email: string;
  parentEmail: string | null;
  paymentMethod: string | null;
  periodEnd: string;
  daysUntilEnd: number; // negative = overdue, positive = days remaining
};

// --- Warning Icon ---
const WarningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-danger-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

// --- Update Modal ---
function UpdateModal({
  student,
  onClose,
  onSuccess,
}: {
  student: UnpaidStudent;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const currentEnd = new Date(student.periodEnd);
  const [newEndDate, setNewEndDate] = useState(currentEnd.toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleDateExtension = (months: number) => {
    const d = new Date(currentEnd);
    d.setMonth(d.getMonth() + months);
    setNewEndDate(d.toISOString().split('T')[0]);
  };

  const handleUpdate = async () => {
    if (!newEndDate) {
      setError('有効な終了日を選択してください。');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const supabase = createClient();
      const { error: updateError } = await (supabase.from('contracts') as any)
        .update({ current_period_end: new Date(newEndDate).toISOString() })
        .eq('id', student.contractId);
      if (updateError) throw updateError;
      onSuccess();
    } catch (err) {
      console.error('Failed to update contract:', err);
      setError('契約の更新に失敗しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4 text-primary-800 dark:text-warm-100">契約更新: {student.displayName}</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="end-date" className="label">新しい契約終了日</label>
            <input
              type="date"
              id="end-date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              className="input mt-1"
              required
            />
          </div>
          <div className="flex justify-center gap-2">
            <button onClick={() => handleDateExtension(1)} className="btn-ghost text-sm">1ヶ月延長</button>
            <button onClick={() => handleDateExtension(3)} className="btn-ghost text-sm">3ヶ月延長</button>
            <button onClick={() => handleDateExtension(6)} className="btn-ghost text-sm">半年延長</button>
          </div>
          {error && <p className="text-sm text-danger-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} disabled={isSubmitting} className="btn-ghost">キャンセル</button>
          <button onClick={handleUpdate} disabled={isSubmitting} className="btn-primary disabled:opacity-50">
            {isSubmitting ? '更新中...' : '更新する'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUnpaidPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<UnpaidStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<UnpaidStudent | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Fetch active contracts not scheduled for cancellation, ending within 10 days or already expired
      const tenDaysFromNow = new Date();
      tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);

      const { data: contractsData, error: contractsError } = await (supabase.from('contracts') as any)
        .select('id, user_id, parent_email, payment_method, status, current_period_end, cancel_at_period_end')
        .eq('status', 'active')
        .eq('cancel_at_period_end', false)
        .lt('current_period_end', tenDaysFromNow.toISOString());

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
        const diffMs = periodEnd.getTime() - nowDate.getTime();
        const daysUntilEnd = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        return {
          userId: contract.user_id,
          contractId: contract.id,
          displayName: user?.display_name || '（不明）',
          email: user?.email || '',
          parentEmail: contract.parent_email,
          paymentMethod: contract.payment_method,
          periodEnd: contract.current_period_end,
          daysUntilEnd,
        };
      });

      // Sort: expired first (most overdue), then upcoming
      unpaidList.sort((a, b) => a.daysUntilEnd - b.daysUntilEnd);
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

  const handleCancelContract = async (student: UnpaidStudent) => {
    if (isActionLoading) return;
    if (window.confirm(`${student.displayName}の契約を期間終了時に解約します。よろしいですか？`)) {
      setIsActionLoading(true);
      try {
        const supabase = createClient();
        const { error: updateError } = await (supabase.from('contracts') as any)
          .update({ cancel_at_period_end: true })
          .eq('id', student.contractId);
        if (updateError) throw updateError;
        setStudents((prev) => prev.filter((s) => s.contractId !== student.contractId));
      } catch (err) {
        console.error('Failed to cancel contract:', err);
        alert('解約処理に失敗しました。');
      } finally {
        setIsActionLoading(false);
      }
    }
  };

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-4xl text-center p-8 mt-8">
        <div className="spinner mx-auto"></div>
        <p className="text-warm-500 dark:text-warm-400 mt-4">読み込み中...</p>
      </div>
    );
  }

  if (!authLoading && currentUser && !['admin', 'super'].includes(currentUser.role)) {
    router.push('/');
    return null;
  }

  return (
    <>
      <div className="w-full max-w-6xl card p-8 mt-8">
        <div className="border-b dark:border-primary-800 pb-4 mb-6">
          <h1 className="text-3xl font-bold text-primary-800 dark:text-warm-100">未払い管理</h1>
          <p className="mt-2 text-sm text-warm-600 dark:text-warm-400">
            契約期間が終了した、または10日以内に終了する生徒の一覧です（解約予約済みの生徒は除外）。
          </p>
        </div>

        {error && <div className="text-center text-danger-500 py-4 mb-4">{error}</div>}

        {students.length === 0 ? (
          <div className="text-center py-20 bg-warm-50 dark:bg-primary-950/30 rounded-card border-2 border-dashed border-warm-200 dark:border-primary-800">
            <div className="text-4xl mb-4">&#10003;</div>
            <p className="text-warm-600 dark:text-warm-400 text-lg font-semibold">該当する生徒はいません</p>
            <p className="text-warm-400 dark:text-warm-500 text-sm mt-2">全ての契約が有効期間内です。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-warm-200 dark:divide-primary-800">
              <thead className="bg-warm-50 dark:bg-primary-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-warm-500 dark:text-warm-300 uppercase tracking-wider">生徒名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-warm-500 dark:text-warm-300 uppercase tracking-wider">メール</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-warm-500 dark:text-warm-300 uppercase tracking-wider">支払方法</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-warm-500 dark:text-warm-300 uppercase tracking-wider">契約終了日</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-warm-500 dark:text-warm-300 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-primary-900 divide-y divide-warm-200 dark:divide-primary-800">
                {students.map((student) => {
                  const isExpired = student.daysUntilEnd < 0;
                  return (
                    <tr
                      key={student.contractId}
                      className={`hover:bg-warm-50 dark:hover:bg-primary-800/50 transition-colors ${isExpired ? 'bg-danger-50 dark:bg-danger-900/20' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-800 dark:text-warm-100">
                        <div className="flex items-center gap-2">
                          {isExpired && <WarningIcon />}
                          <Link href={`/admin/student/${student.userId}`} className="text-primary-600 dark:text-primary-400 hover:underline">
                            {student.displayName}
                          </Link>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-warm-500 dark:text-warm-400">{student.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-warm-500 dark:text-warm-400">{student.paymentMethod || '未設定'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-warm-500 dark:text-warm-400">
                        {new Date(student.periodEnd).toLocaleDateString('ja-JP')}
                        {isExpired ? (
                          <span className="ml-2 text-xs font-semibold text-danger-600">{Math.abs(student.daysUntilEnd)}日超過</span>
                        ) : (
                          <span className="ml-2 text-xs font-semibold text-warning-600">残{student.daysUntilEnd}日</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex justify-center items-center gap-2">
                          <button
                            onClick={() => { setSelectedStudent(student); setIsModalOpen(true); }}
                            disabled={isActionLoading}
                            className="px-3 py-1 text-sm bg-success-500 text-white rounded-btn hover:bg-success-600 disabled:opacity-50"
                          >
                            更新
                          </button>
                          <button
                            onClick={() => handleCancelContract(student)}
                            disabled={isActionLoading}
                            className="px-3 py-1 text-sm bg-danger-500 text-white rounded-btn hover:bg-danger-600 disabled:opacity-50"
                          >
                            解約
                          </button>
                          <Link
                            href={`/admin/student/${student.userId}/contract`}
                            className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-200"
                          >
                            詳細
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && selectedStudent && (
        <UpdateModal
          student={selectedStudent}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchData();
          }}
        />
      )}
    </>
  );
}
