'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function MyPage() {
  const { currentUser, loading } = useAuth();
  const supabase = createClient();
  const [pointBalance, setPointBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    supabase.rpc('get_point_balance', { p_user_id: currentUser.id })
      .then(({ data }) => setPointBalance(data ?? 0));
  }, [currentUser]);

  if (loading) {
    return <div className="spinner"></div>;
  }

  return (
    <div className="w-full max-w-2xl animate-fade-in">
      <div className="card p-8">
        <div className="flex items-center gap-4 mb-6">
          {currentUser?.photoURL && (
            <img src={currentUser.photoURL} alt="" className="w-16 h-16 rounded-full" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-700 dark:text-gray-100 tracking-wider">
              {currentUser?.displayName ?? 'マイページ'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{currentUser?.email}</p>
          </div>
        </div>

        {/* Point Balance */}
        <Link href="/mypage/points" className="block mb-6 p-4 bg-accent-50 dark:bg-accent-900/20 rounded-xl border border-accent-200 dark:border-accent-800 hover:bg-accent-100 dark:hover:bg-accent-900/30 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <span className="font-semibold text-gray-800 dark:text-gray-100">FAST-UPポイント</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-accent-600">{pointBalance ?? '-'}</span>
              <span className="text-sm text-accent-600">pt</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
        </Link>

        <div className="space-y-3">
          <Link href="/mypage/profile" className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <span className="font-semibold text-gray-800 dark:text-gray-100">プロフィール編集</span>
          </Link>
          <Link href="/mypage/contract" className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <span className="font-semibold text-gray-800 dark:text-gray-100">契約情報</span>
          </Link>
          <Link href="/mypage/applications" className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <span className="font-semibold text-gray-800 dark:text-gray-100">申込状況</span>
          </Link>
          <Link href="/mypage/analytics" className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <span className="font-semibold text-gray-800 dark:text-gray-100">学習分析</span>
          </Link>
          <Link href="/mypage/attendance" className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <span className="font-semibold text-gray-800 dark:text-gray-100">出席予定</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
