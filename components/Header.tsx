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
    <header className="bg-white dark:bg-gray-800 shadow-md w-full">
      <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors duration-200 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="前のページに戻る"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">戻る</span>
            </button>
          )}
          <Link href="/" className="text-xl font-bold text-gray-800 dark:text-white hover:text-gray-700 dark:hover:text-gray-300">
            Home
          </Link>
        </div>
        <div>
          {currentUser ? (
            <button
              onClick={handleSignOut}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 transition-colors duration-300"
            >
              ログアウト
            </button>
          ) : (
            <Link
              href="/login"
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-colors duration-300"
            >
              ログイン
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
