'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  CurriculumIcon,
  SpecialCourseIcon,
  AttendClassIcon,
  TimelineIcon,
  MyPageIcon,
} from './Icons';

const TABS = [
  { path: '/curriculums', label: 'カリキュラム', icon: CurriculumIcon },
  { path: '/specials', label: '特別講座', icon: SpecialCourseIcon },
  { path: '/classes', label: '毎日個別特訓', icon: AttendClassIcon },
  { path: '/timeline', label: 'タイムライン', icon: TimelineIcon },
  { path: '/mypage', label: 'マイページ', icon: MyPageIcon },
];

export function BottomNavBar() {
  const pathname = usePathname();
  const { currentUser } = useAuth();

  // Only show for students (admin/super use desktop layout on all devices)
  if (!currentUser || ['admin', 'super'].includes(currentUser.role)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white dark:bg-primary-900 border-t border-warm-200 dark:border-primary-800 flex justify-around items-center z-40 md:hidden">
      {TABS.map((tab, index) => {
        const isActive = pathname.startsWith(tab.path);
        const isCenter = index === 2;

        if (isCenter) {
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className="relative flex-1 flex flex-col items-center justify-center -mt-8"
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 transform ${
                  isActive
                    ? 'bg-primary-500 shadow-lg shadow-primary-500/30 scale-105'
                    : 'bg-primary-400 shadow-md hover:bg-primary-500'
                }`}
              >
                <tab.icon className="h-8 w-8 text-white" />
              </div>
              <span
                className={`text-xs mt-2 font-semibold transition-colors ${
                  isActive
                    ? 'text-primary-600 dark:text-accent-400'
                    : 'text-warm-500 dark:text-warm-500'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`flex-1 flex flex-col items-center justify-center h-full transition-colors ${
              isActive
                ? 'text-primary-600 dark:text-accent-400'
                : 'text-warm-500 dark:text-warm-500 hover:text-primary-500'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            <tab.icon className="h-6 w-6 mb-1" />
            <span className="text-xs font-medium">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
