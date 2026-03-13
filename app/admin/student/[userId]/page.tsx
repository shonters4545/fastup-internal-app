'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

const gradeOptions: Record<string, string> = {
  high_3: '高3生',
  high_2: '高2生',
  high_1: '高1生',
  ronin: '浪人生',
  junior_high: '中学生',
};

type StudentInfo = {
  id: string;
  nickname: string | null;
  email: string | null;
  grade: string | null;
  target_college: string | null;
  learning_location: string | null;
  high_school: string | null;
  phone_number: string | null;
  photo_url: string | null;
};

export default function StudentDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [subjectNames, setSubjectNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !currentUser || !userId) return;

    const fetchStudent = async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase.from('users') as any)
          .select('id, nickname, email, grade, target_college, learning_location, high_school, phone_number, photo_url')
          .eq('id', userId)
          .single();
        if (error) throw error;
        setStudent(data as StudentInfo);

        // Fetch user subjects
        const { data: userSubs } = await (supabase.from('user_subjects') as any)
          .select('subject_id, subjects(name)')
          .eq('user_id', userId);
        if (userSubs) {
          setSubjectNames((userSubs as any[]).map(us => us.subjects?.name || '不明'));
        }
      } catch (err) {
        console.error('Error fetching student:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [userId, currentUser, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner" />
      </div>
    );
  }

  if (!authLoading && currentUser && !['admin', 'super'].includes(currentUser.role)) {
    router.push('/');
    return null;
  }

  if (!student) {
    return (
      <div className="text-center py-12 text-danger-500">生徒が見つかりません。</div>
    );
  }

  const navItems = [
    { href: `/admin/student/${userId}/profile`, label: 'プロフィール編集', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: 'blue' },
    { href: `/admin/student/${userId}/contract`, label: '契約情報', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'green' },
    { href: `/admin/student/${userId}/status`, label: '学習ステータス', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', color: 'purple' },
    { href: `/admin/student/${userId}/curriculum`, label: 'カリキュラム', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', color: 'orange' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 text-primary-700 dark:text-primary-300',
    green: 'bg-success-50 dark:bg-success-900/20 hover:bg-success-100 dark:hover:bg-success-900/40 text-success-700 dark:text-success-300',
    purple: 'bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 text-primary-700 dark:text-primary-300',
    orange: 'bg-warning-50 dark:bg-warning-900/20 hover:bg-warning-100 dark:hover:bg-warning-900/40 text-warning-700 dark:text-warning-300',
  };

  return (
    <div className="w-full max-w-4xl animate-fade-in mt-8">
      {/* Back Link */}
      <Link href="/admin/students" className="inline-flex items-center text-sm text-primary-600 dark:text-primary-400 hover:underline mb-4">
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        生徒一覧に戻る
      </Link>

      {/* Student Info Card */}
      <div className="card mb-6">
        <div className="flex items-center gap-6 mb-6">
          {student.photo_url ? (
            <img src={student.photo_url} alt={student.nickname || ''} className="w-20 h-20 rounded-full object-cover shadow-md" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-warm-200 dark:bg-primary-800 flex items-center justify-center text-warm-400 text-2xl font-bold">
              {(student.nickname || '?')[0]}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-primary-800 dark:text-warm-100">{student.nickname || '名前未設定'}</h1>
            <p className="text-warm-500 dark:text-warm-400">{student.email || 'メール未設定'}</p>
          </div>
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-warm-50 dark:bg-primary-800/50 p-3 rounded-btn">
            <p className="text-xs text-warm-500 dark:text-warm-400">学年</p>
            <p className="font-semibold text-primary-800 dark:text-warm-100">{student.grade ? gradeOptions[student.grade] || student.grade : '未設定'}</p>
          </div>
          <div className="bg-warm-50 dark:bg-primary-800/50 p-3 rounded-btn">
            <p className="text-xs text-warm-500 dark:text-warm-400">受講場所</p>
            <p className="font-semibold text-primary-800 dark:text-warm-100">{student.learning_location === 'classroom' ? '教室' : student.learning_location === 'online' ? 'オンライン' : '未設定'}</p>
          </div>
          <div className="bg-warm-50 dark:bg-primary-800/50 p-3 rounded-btn">
            <p className="text-xs text-warm-500 dark:text-warm-400">志望校</p>
            <p className="font-semibold text-primary-800 dark:text-warm-100 truncate">{student.target_college || '未設定'}</p>
          </div>
          <div className="bg-warm-50 dark:bg-primary-800/50 p-3 rounded-btn">
            <p className="text-xs text-warm-500 dark:text-warm-400">高校名</p>
            <p className="font-semibold text-primary-800 dark:text-warm-100 truncate">{student.high_school || '未設定'}</p>
          </div>
        </div>

        {/* Subject Badges */}
        {subjectNames.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-xs text-warm-500 dark:text-warm-400 self-center mr-2">科目:</span>
            {subjectNames.map((name, i) => (
              <span key={i} className="text-xs font-semibold px-3 py-1 badge-danger">{name}</span>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`${colorMap[item.color]} rounded-xl p-6 shadow-card transition-all duration-200 transform hover:-translate-y-1 flex items-center gap-4`}>
            <svg className="w-8 h-8 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
            <span className="text-lg font-bold">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
