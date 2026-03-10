'use client';

import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import GoogleLogo from '@/components/GoogleLogo';

const errorMessages: Record<string, string> = {
  auth_failed: 'ログインに失敗しました。もう一度お試しください。',
  exchange_failed: '認証処理中にエラーが発生しました。',
  no_code: '認証コードが取得できませんでした。',
  no_profile: 'ユーザー登録が見つかりません。招待メールを確認してください。',
};

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const errorDetail = searchParams.get('detail');

  const errorMessage = errorParam
    ? errorMessages[errorParam] || 'ログインエラーが発生しました。'
    : null;

  return (
    <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center animate-fade-in mt-8">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Welcome!</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8">Sign in with your Google account to continue.</p>

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/50 rounded-lg">
          <p className="text-red-700 dark:text-red-300 text-sm font-medium">{errorMessage}</p>
          {errorDetail && (
            <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errorDetail}</p>
          )}
        </div>
      )}

      <button
        onClick={signInWithGoogle}
        className="w-full inline-flex items-center justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-3 px-6 border border-gray-300 dark:border-gray-600 rounded-lg shadow-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-all duration-300 ease-in-out"
      >
        <GoogleLogo />
        <span>Sign in with Google</span>
      </button>
    </div>
  );
}
