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
    <header className="bg-primary-700 w-full shadow-header">
      <nav className="container mx-auto px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 text-primary-200 hover:text-white transition-colors text-sm px-2 py-1 rounded-btn hover:bg-white/10"
              aria-label="前のページに戻る"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              戻る
            </button>
          )}
          <Link href="/" className="text-xl font-bold text-white tracking-wider hover:text-accent-300 transition-colors">
            FAST-UP
          </Link>
        </div>
        <div>
          {currentUser ? (
            <button
              onClick={handleSignOut}
              className="text-primary-200 hover:text-white text-sm font-medium px-3 py-1.5 rounded-btn hover:bg-white/10 transition-colors"
            >
              ログアウト
            </button>
          ) : (
            <Link href="/login" className="bg-accent-500 hover:bg-accent-400 text-white font-semibold text-sm px-4 py-2 rounded-btn transition-colors shadow-sm">
              ログイン
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
