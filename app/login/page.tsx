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
    <div className="w-full max-w-md animate-fade-in mt-8">
      {/* Main card */}
      <div className="card text-center">
        {/* Decorative top bar */}
        <div className="h-1 w-16 bg-primary-500 rounded-badge mx-auto mb-8" />

        <h1 className="text-3xl font-bold text-primary-700 dark:text-warm-100 mb-2 tracking-wider">
          FAST-UP
        </h1>
        <p className="text-warm-500 dark:text-warm-400 mb-8 text-sm">
          アカウントにログインして始めましょう
        </p>

        {errorMessage && (
          <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-500/10 rounded-btn border border-danger-100 dark:border-danger-700">
            <p className="text-danger-600 dark:text-danger-500 text-sm font-medium">{errorMessage}</p>
            {errorDetail && (
              <p className="text-danger-500 dark:text-danger-500 text-xs mt-1 opacity-75">{errorDetail}</p>
            )}
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          className="w-full inline-flex items-center justify-center
                     bg-white dark:bg-primary-800 text-primary-700 dark:text-warm-200
                     font-semibold py-3 px-6
                     border border-warm-300 dark:border-primary-700
                     rounded-btn shadow-card
                     hover:shadow-card-hover hover:border-primary-300
                     dark:hover:border-primary-600
                     focus-visible:ring-2 focus-visible:ring-primary-400
                     transition-all duration-300 ease-out"
        >
          <GoogleLogo />
          <span>Googleアカウントでログイン</span>
        </button>
      </div>
    </div>
  );
}
