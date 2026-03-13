'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  MyPageIcon, CurriculumIcon, AttendClassIcon, SpecialCourseIcon,
  TimelineIcon, StudentListIcon, OpenClassIcon, AttendanceIcon,
  PersonalLectureIcon, SurveyIcon, UnpaidIcon, LaborCostIcon,
  PostAdminIcon, InstructorListIcon,
} from '@/components/Icons';

/* Card color variants - olive-themed tonal palette */
const cardVariants = {
  olive:    'bg-primary-500 hover:bg-primary-600',
  dark:     'bg-primary-700 hover:bg-primary-800',
  gold:     'bg-accent-600 hover:bg-accent-700',
  sage:     'bg-success-600 hover:bg-success-700',
  earth:    'bg-warning-600 hover:bg-warning-700',
  stone:    'bg-warm-600 hover:bg-warm-700',
  slate:    'bg-info-600 hover:bg-info-700',
  clay:     'bg-danger-600 hover:bg-danger-700',
  bronze:   'bg-accent-700 hover:bg-accent-800',
  moss:     'bg-success-700 hover:bg-success-600',
  sand:     'bg-warning-700 hover:bg-warning-600',
} as const;

type CardVariant = keyof typeof cardVariants;

const MenuCard = ({ href, icon, title, description, variant }: {
  href: string; icon: React.ReactNode; title: string; description: string; variant: CardVariant;
}) => (
  <Link
    href={href}
    className={`block p-5 rounded-card shadow-card hover:shadow-card-hover
                transition-all duration-300 ease-out transform hover:-translate-y-0.5
                ${cardVariants[variant]}`}
  >
    <div className="flex items-start space-x-4">
      <div className="text-white/90 p-2.5 bg-white/15 rounded-lg shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold text-white tracking-wide">{title}</h3>
        <p className="text-sm text-white/75 mt-0.5">{description}</p>
      </div>
    </div>
  </Link>
);

export default function HomePage() {
  const { currentUser, loading } = useAuth();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin && currentUser && window.innerWidth < 768) {
      router.push('/curriculums');
    }
  }, [loading, isAdmin, currentUser, router]);

  return (
    <div className="w-full max-w-4xl animate-fade-in md:mt-8">
      {/* Student menu */}
      {!isAdmin && !loading && currentUser && (
        <div className="card">
          <h1 className="text-2xl font-bold text-primary-700 dark:text-warm-100 mb-6 text-center tracking-wider">
            トップページ
          </h1>
          <section>
            <h2 className="text-sm font-semibold text-warm-500 dark:text-warm-400 mb-4 uppercase tracking-widest">
              メニュー
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <MenuCard href="/mypage" icon={<MyPageIcon />} title="マイページ" description="プロフィールや契約情報" variant="olive" />
              <MenuCard href="/curriculums" icon={<CurriculumIcon />} title="学習カリキュラム" description="今日のタスクと進捗" variant="dark" />
              <MenuCard href="/classes" icon={<AttendClassIcon />} title="毎日個別特訓に参加する" description="オンライン講義に参加" variant="sage" />
              <MenuCard href="/specials" icon={<SpecialCourseIcon />} title="特別講座" description="期間限定の講座に申込" variant="gold" />
              <MenuCard href="/timeline" icon={<TimelineIcon />} title="お知らせタイムライン" description="運営からのお知らせを確認" variant="slate" />
            </div>
          </section>
        </div>
      )}

      {/* Admin menu */}
      {(loading || isAdmin) && (
        <div className="w-full card">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="spinner" />
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-primary-700 dark:text-warm-100 mb-6 text-center tracking-wider">
                トップページ
              </h1>
              <section>
                <h2 className="text-sm font-semibold text-warm-500 dark:text-warm-400 mb-4 uppercase tracking-widest">
                  管理者メニュー
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <MenuCard href="/admin/students" icon={<StudentListIcon />} title="生徒一覧" description="担当生徒の情報を管理" variant="olive" />
                  <MenuCard href="/admin/classes" icon={<OpenClassIcon />} title="特訓管理" description="特訓の開催と入室管理" variant="dark" />
                  <MenuCard href="/admin/attendance" icon={<AttendanceIcon />} title="出席管理" description="出席予想と過去の出席実績" variant="sage" />
                  <MenuCard href="/admin/specials" icon={<SpecialCourseIcon />} title="特別講座" description="特別講座の作成と管理" variant="slate" />
                  <MenuCard href="/admin/personal-entries" icon={<PersonalLectureIcon />} title="個別講義管理" description="個別指導の申込を管理" variant="gold" />
                  <MenuCard href="/admin/surveys" icon={<SurveyIcon />} title="アンケート管理" description="全生徒向けアンケートを作成・管理" variant="stone" />
                  <MenuCard href="/admin/unpaid" icon={<UnpaidIcon />} title="未払い管理" description="契約更新が必要な生徒" variant="earth" />
                  <MenuCard href="/admin/labor-cost" icon={<LaborCostIcon />} title="人件費管理" description="人件費率と予測の管理" variant="clay" />
                  <MenuCard href="/admin/posts" icon={<PostAdminIcon />} title="記事管理" description="お知らせ記事の編集・削除" variant="bronze" />
                  <MenuCard href="/timeline" icon={<TimelineIcon />} title="お知らせタイムライン" description="運営からのお知らせを確認" variant="moss" />
                  {currentUser?.role === 'super' && (
                    <MenuCard href="/admin/instructors" icon={<InstructorListIcon />} title="講師一覧" description="講師の招待と管理" variant="sand" />
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {/* Guest */}
      {!loading && !currentUser && (
        <div className="card text-center">
          <div className="h-1 w-16 bg-primary-500 rounded-badge mx-auto mb-8" />
          <h1 className="text-3xl font-bold text-primary-700 dark:text-warm-100 mb-3 tracking-wider">
            FAST-UP
          </h1>
          <p className="text-warm-500 dark:text-warm-400 mb-8 text-sm">
            塾生管理アプリへようこそ
          </p>
          <Link href="/login" className="btn-primary text-base px-8 py-3">
            ログインして始める
          </Link>
        </div>
      )}
    </div>
  );
}
