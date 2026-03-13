'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export function Header() {
  const { currentUser, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const showBackButton = pathname !== '/' && pathname !== '/login';

  return (
    <header className="bg-white dark:bg-primary-900 shadow-header w-full border-b border-warm-200 dark:border-primary-800">
      <nav className="container mx-auto px-6 py-3.5 flex justify-between items-center">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <button
              onClick={() => router.back()}
              className="btn-ghost !px-2.5 !py-1.5 text-sm"
              aria-label="前のページに戻る"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              戻る
            </button>
          )}
          <Link href="/" className="text-xl font-bold text-primary-600 dark:text-accent-400 tracking-wider hover:text-primary-500 dark:hover:text-accent-300 transition-colors">
            FAST-UP
          </Link>
        </div>
        <div>
          {currentUser ? (
            <button
              onClick={handleSignOut}
              className="btn-ghost !text-danger-500 hover:!bg-danger-50 dark:hover:!bg-danger-500/10 text-sm"
            >
              ログアウト
            </button>
          ) : (
            <Link href="/login" className="btn-primary text-sm">
              ログイン
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
