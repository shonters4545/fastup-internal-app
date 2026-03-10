'use client';

import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function MyPage() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div className="w-16 h-16 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>;
  }

  return (
    <div className="w-full max-w-2xl animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="flex items-center gap-4 mb-6">
          {currentUser?.photoURL && (
            <img src={currentUser.photoURL} alt="" className="w-16 h-16 rounded-full" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              {currentUser?.displayName ?? 'マイページ'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{currentUser?.email}</p>
          </div>
        </div>
        <div className="space-y-3">
          <Link href="/mypage/profile" className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
            <span className="font-semibold text-gray-800 dark:text-white">プロフィール編集</span>
          </Link>
          <Link href="/mypage/contract" className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
            <span className="font-semibold text-gray-800 dark:text-white">契約情報</span>
          </Link>
          <Link href="/mypage/applications" className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
            <span className="font-semibold text-gray-800 dark:text-white">申込状況</span>
          </Link>
          <Link href="/mypage/analytics" className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
            <span className="font-semibold text-gray-800 dark:text-white">学習分析</span>
          </Link>
          <Link href="/mypage/attendance" className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
            <span className="font-semibold text-gray-800 dark:text-white">出席予定</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
