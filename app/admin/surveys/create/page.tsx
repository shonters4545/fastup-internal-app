'use client';

// TODO: Migrate from components/AdminCreateSurveyPage.tsx
// Replace Firestore calls with Supabase client calls

import { useAuth } from '@/hooks/useAuth';

export default function AdminCreateSurveyPage() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div className="w-16 h-16 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto"></div>;
  }

  return (
    <div className="w-full max-w-4xl animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">アンケート作成</h1>
        <p className="text-gray-600 dark:text-gray-400">このページは移行中です。</p>
      </div>
    </div>
  );
}
