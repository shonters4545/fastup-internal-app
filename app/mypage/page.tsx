'use client';

import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function MyPage() {
  const { currentUser, loading } = useAuth();

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
            <h1 className="text-2xl font-bold text-primary-700 dark:text-warm-100 tracking-wider">
              {currentUser?.displayName ?? 'マイページ'}
            </h1>
            <p className="text-warm-600 dark:text-warm-400">{currentUser?.email}</p>
          </div>
        </div>
        <div className="space-y-3">
          <Link href="/mypage/profile" className="block w-full text-left p-4 bg-warm-50 dark:bg-primary-800 rounded-xl hover:bg-warm-50 dark:hover:bg-primary-700 transition-colors">
            <span className="font-semibold text-primary-800 dark:text-warm-100">プロフィール編集</span>
          </Link>
          <Link href="/mypage/contract" className="block w-full text-left p-4 bg-warm-50 dark:bg-primary-800 rounded-xl hover:bg-warm-50 dark:hover:bg-primary-700 transition-colors">
            <span className="font-semibold text-primary-800 dark:text-warm-100">契約情報</span>
          </Link>
          <Link href="/mypage/applications" className="block w-full text-left p-4 bg-warm-50 dark:bg-primary-800 rounded-xl hover:bg-warm-50 dark:hover:bg-primary-700 transition-colors">
            <span className="font-semibold text-primary-800 dark:text-warm-100">申込状況</span>
          </Link>
          <Link href="/mypage/analytics" className="block w-full text-left p-4 bg-warm-50 dark:bg-primary-800 rounded-xl hover:bg-warm-50 dark:hover:bg-primary-700 transition-colors">
            <span className="font-semibold text-primary-800 dark:text-warm-100">学習分析</span>
          </Link>
          <Link href="/mypage/attendance" className="block w-full text-left p-4 bg-warm-50 dark:bg-primary-800 rounded-xl hover:bg-warm-50 dark:hover:bg-primary-700 transition-colors">
            <span className="font-semibold text-primary-800 dark:text-warm-100">出席予定</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
