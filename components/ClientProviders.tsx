'use client';

import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { BottomNavBar } from '@/components/BottomNavBar';
import { SurveyProvider } from '@/components/SurveyProvider';

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const isStudent = currentUser && !['admin', 'super'].includes(currentUser.role);

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
      <Header />
      <main className={`w-full flex flex-col items-center justify-center p-4 ${isStudent ? 'pb-24 md:pb-4' : 'pb-4'}`}>
        {children}
      </main>
      <BottomNavBar />
    </div>
  );
}

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SurveyProvider>
        <LayoutContent>{children}</LayoutContent>
      </SurveyProvider>
    </AuthProvider>
  );
}
