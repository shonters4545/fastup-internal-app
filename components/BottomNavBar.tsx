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

  if (!currentUser) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around items-center shadow-top z-40 md:hidden">
      {TABS.map((tab, index) => {
        const isActive = pathname.startsWith(tab.path);
        const isCenter = index === 2;

        if (isCenter) {
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className="relative flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 -mt-8"
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 transform ${
                  isActive ? 'bg-blue-600 shadow-lg' : 'bg-blue-500 shadow-md'
                }`}
              >
                <tab.icon className="h-8 w-8 text-white" />
              </div>
              <span
                className={`text-xs mt-2 font-semibold transition-colors ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400'
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
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-blue-500'
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
