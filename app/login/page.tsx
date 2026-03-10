'use client';

import { useAuth } from '@/hooks/useAuth';
import GoogleLogo from '@/components/GoogleLogo';

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center animate-fade-in mt-8">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Welcome!</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8">Sign in with your Google account to continue.</p>
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
