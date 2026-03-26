'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

type Transaction = {
  id: string;
  amount: number;
  reason: string;
  created_at: string | null;
};

const REWARDS = [
  { points: 10, label: 'FAST-UPステッカー' },
  { points: 30, label: '合宿 1,000円OFF / FAST-UPトートバッグ' },
  { points: 60, label: '合宿 2,500円OFF / FAST-UP Tシャツ' },
  { points: 90, label: '合宿 5,000円OFF / FAST-UPパーカー' },
  { points: 120, label: 'Amazonギフト券 500円分' },
  { points: 240, label: 'Amazonギフト券 1,500円分' },
  { points: 360, label: 'Amazonギフト券 3,000円分' },
];

export default function StudentPointsPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !currentUser) return;

    const fetchData = async () => {
      try {
        const [{ data: balanceData }, { data: txns }] = await Promise.all([
          supabase.rpc('get_point_balance', { p_user_id: currentUser.id }),
          (supabase.from('point_transactions') as any)
            .select('id, amount, reason, created_at')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(50),
        ]);
        setBalance(balanceData ?? 0);
        setTransactions(txns || []);
      } catch (err) {
        console.error('Error fetching points:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, authLoading]);

  if (authLoading || loading) {
    return <div className="flex justify-center py-12"><div className="spinner" /></div>;
  }

  // Find next reward target
  const nextReward = REWARDS.find((r) => r.points > balance);
  const progressPercent = nextReward
    ? Math.min(100, Math.round((balance / nextReward.points) * 100))
    : 100;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      month: 'short', day: 'numeric',
    });
  };

  return (
    <div className="w-full max-w-2xl animate-fade-in">
      {/* Back */}
      <Link href="/mypage" className="inline-flex items-center text-sm text-primary-600 dark:text-gray-400 hover:underline mb-4">
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        マイページに戻る
      </Link>

      {/* Balance Card */}
      <div className="card mb-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">保有ポイント</p>
        <p className="text-5xl font-bold text-accent-600 mb-2">{balance}<span className="text-xl ml-1">pt</span></p>
        {nextReward && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>次の目標: {nextReward.label}</span>
              <span>{balance} / {nextReward.points} pt</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-accent-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Rewards List */}
      <div className="card mb-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">ご褒美一覧</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">合宿割引は併用可能です。コツコツ貯めるほどお得！</p>
        <div className="space-y-3">
          {REWARDS.map((reward) => {
            const unlocked = balance >= reward.points;
            return (
              <div
                key={reward.points}
                className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${
                  unlocked
                    ? 'bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800'
                    : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800'
                }`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  unlocked
                    ? 'bg-accent-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                }`}>
                  {unlocked ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>{reward.points}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${
                    unlocked ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {reward.label}
                  </p>
                  <p className={`text-xs ${
                    unlocked ? 'text-accent-600' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {reward.points} pt {unlocked ? '- 交換可能！' : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction History */}
      <div className="card">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">獲得履歴</h2>
        {transactions.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">まだ履歴はありません</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{tx.reason}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(tx.created_at)}</p>
                </div>
                <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-success-600' : 'text-danger-600'}`}>
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
