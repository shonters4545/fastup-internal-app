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
    <div className="w-full max-w-md animate-fade-in mt-12">
      <div className="card text-center">
        <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-white text-lg font-bold">F</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2 tracking-wider">
          FAST-UP
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
          アカウントにログインして始めましょう
        </p>

        {errorMessage && (
          <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-500/10 rounded-btn border border-danger-100 dark:border-danger-700">
            <p className="text-danger-600 dark:text-danger-500 text-sm font-medium">{errorMessage}</p>
            {errorDetail && (
              <p className="text-danger-500 text-xs mt-1 opacity-75">{errorDetail}</p>
            )}
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          className="w-full inline-flex items-center justify-center
                     bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200
                     font-semibold py-3 px-6
                     border border-gray-300 dark:border-gray-600
                     rounded-btn shadow-sm
                     hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700
                     transition-all duration-200"
        >
          <GoogleLogo />
          <span>Googleアカウントでログイン</span>
        </button>
      </div>
    </div>
  );
}
