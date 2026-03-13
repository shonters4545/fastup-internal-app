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

const MenuCard = ({ href, icon, title, description, color }: {
  href: string; icon: React.ReactNode; title: string; description: string; color: string;
}) => (
  <Link
    href={href}
    className="group flex items-start gap-4 p-4 rounded-card bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:shadow-card-hover hover:border-accent-400 transition-all duration-200"
  >
    <div className={`shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${color}`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 group-hover:text-accent-600 transition-colors">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
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
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center tracking-wider">
            トップページ
          </h1>
          <section>
            <h2 className="text-xs font-semibold text-gray-400 mb-4 uppercase tracking-widest">メニュー</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <MenuCard href="/mypage" icon={<MyPageIcon />} title="マイページ" description="プロフィールや契約情報" color="bg-primary-600 text-white" />
              <MenuCard href="/curriculums" icon={<CurriculumIcon />} title="学習カリキュラム" description="今日のタスクと進捗" color="bg-accent-500 text-white" />
              <MenuCard href="/classes" icon={<AttendClassIcon />} title="毎日個別特訓に参加する" description="オンライン講義に参加" color="bg-primary-500 text-white" />
              <MenuCard href="/specials" icon={<SpecialCourseIcon />} title="特別講座" description="期間限定の講座に申込" color="bg-accent-600 text-white" />
              <MenuCard href="/timeline" icon={<TimelineIcon />} title="お知らせタイムライン" description="運営からのお知らせを確認" color="bg-primary-700 text-white" />
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
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center tracking-wider">
                トップページ
              </h1>
              <section>
                <h2 className="text-xs font-semibold text-gray-400 mb-4 uppercase tracking-widest">管理者メニュー</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <MenuCard href="/admin/students" icon={<StudentListIcon />} title="生徒一覧" description="担当生徒の情報を管理" color="bg-primary-600 text-white" />
                  <MenuCard href="/admin/classes" icon={<OpenClassIcon />} title="特訓管理" description="特訓の開催と入室管理" color="bg-accent-500 text-white" />
                  <MenuCard href="/admin/attendance" icon={<AttendanceIcon />} title="出席管理" description="出席予想と過去の出席実績" color="bg-primary-500 text-white" />
                  <MenuCard href="/admin/specials" icon={<SpecialCourseIcon />} title="特別講座" description="特別講座の作成と管理" color="bg-accent-600 text-white" />
                  <MenuCard href="/admin/personal-entries" icon={<PersonalLectureIcon />} title="個別講義管理" description="個別指導の申込を管理" color="bg-primary-700 text-white" />
                  <MenuCard href="/admin/surveys" icon={<SurveyIcon />} title="アンケート管理" description="全生徒向けアンケートを作成・管理" color="bg-primary-600 text-white" />
                  <MenuCard href="/admin/unpaid" icon={<UnpaidIcon />} title="未払い管理" description="契約更新が必要な生徒" color="bg-accent-500 text-white" />
                  <MenuCard href="/admin/labor-cost" icon={<LaborCostIcon />} title="人件費管理" description="人件費率と予測の管理" color="bg-primary-500 text-white" />
                  <MenuCard href="/admin/posts" icon={<PostAdminIcon />} title="記事管理" description="お知らせ記事の編集・削除" color="bg-accent-600 text-white" />
                  <MenuCard href="/timeline" icon={<TimelineIcon />} title="お知らせタイムライン" description="運営からのお知らせを確認" color="bg-primary-700 text-white" />
                  {currentUser?.role === 'super' && (
                    <MenuCard href="/admin/instructors" icon={<InstructorListIcon />} title="講師一覧" description="講師の招待と管理" color="bg-accent-500 text-white" />
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
          <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-white text-lg font-bold">F</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-3 tracking-wider">
            FAST-UP
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
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
