'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

type Transaction = {
  id: string;
  amount: number;
  reason: string;
  reference_type: string | null;
  created_by: string | null;
  created_at: string | null;
  creator_name?: string;
};

const REASON_PRESETS = ['ボーナス', '模試上位', '勉強記録', 'THE FAST-UP受賞', '友達紹介', '調整'];

export default function AdminPointsPage() {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [studentName, setStudentName] = useState('');
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const [{ data: user }, { data: balanceData }, { data: txns }] = await Promise.all([
        (supabase.from('users') as any).select('nickname').eq('id', userId).single(),
        (supabase.rpc as any)('get_point_balance', { p_user_id: userId }),
        (supabase.from('point_transactions') as any)
          .select('id, amount, reason, reference_type, created_by, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (user) setStudentName(user.nickname || '名前未設定');
      setBalance(balanceData ?? 0);

      if (txns && txns.length > 0) {
        const creatorIds = [...new Set(txns.filter((t: Transaction) => t.created_by).map((t: Transaction) => t.created_by))];
        let creatorMap: Record<string, string> = {};
        if (creatorIds.length > 0) {
          const { data: creators } = await (supabase.from('users') as any)
            .select('id, nickname')
            .in('id', creatorIds);
          if (creators) {
            creatorMap = Object.fromEntries(creators.map((c: any) => [c.id, c.nickname || '管理者']));
          }
        }
        setTransactions(txns.map((t: Transaction) => ({
          ...t,
          creator_name: t.created_by ? (creatorMap[t.created_by] || '管理者') : 'システム',
        })));
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error('Error fetching point data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading || !currentUser || !userId) return;
    fetchData();
  }, [userId, currentUser, authLoading, fetchData]);

  if (authLoading || loading) {
    return <div className="flex justify-center py-12"><div className="spinner" /></div>;
  }

  if (!authLoading && currentUser && !['admin', 'super'].includes(currentUser.role)) {
    router.push('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount === 0 || !reason.trim()) {
      alert('ポイント数（0以外）と理由を入力してください。');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase.from('point_transactions') as any).insert({
        user_id: userId,
        amount: numAmount,
        reason: reason.trim(),
        reference_type: 'manual',
        created_by: currentUser!.id,
      });
      if (error) throw error;
      setAmount('');
      setReason('');
      await fetchData();
    } catch (err) {
      console.error('Error adding points:', err);
      alert('ポイントの追加に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="w-full max-w-4xl animate-fade-in mt-8">
      <Link href={`/admin/student/${userId}`} className="inline-flex items-center text-sm text-primary-600 dark:text-gray-400 hover:underline mb-4">
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        生徒詳細に戻る
      </Link>

      {/* Header */}
      <div className="card mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{studentName}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">ポイント管理</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">保有ポイント</p>
            <p className="text-4xl font-bold text-accent-600">{balance}<span className="text-lg ml-1">pt</span></p>
          </div>
        </div>
      </div>

      {/* Manual Adjustment Form */}
      <div className="card mb-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">ポイント加減点</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">ポイント数</label>
            <input
              type="number"
              className="input w-full"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例: 5（加点）, -3（減点）"
            />
          </div>
          <div>
            <label className="label">理由</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {REASON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    reason === preset
                      ? 'bg-accent-500 text-white border-accent-500'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-accent-400'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="input w-full"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="理由を入力"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? '処理中...' : 'ポイントを反映'}
          </button>
        </form>
      </div>

      {/* Transaction History */}
      <div className="card">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">ポイント履歴</h2>
        {transactions.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">履歴はありません</p>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 dark:text-gray-100">{tx.reason}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(tx.created_at)} / {tx.creator_name}
                  </p>
                </div>
                <span className={`text-lg font-bold ${tx.amount > 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount} pt
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
