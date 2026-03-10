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

const MenuCard = ({ href, icon, title, description, colorClass }: {
  href: string; icon: React.ReactNode; title: string; description: string; colorClass: string;
}) => (
  <Link href={href} className={`block p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 ${colorClass}`}>
    <div className="flex items-start space-x-4">
      <div className="text-white p-2 bg-black bg-opacity-20 rounded-xl">{icon}</div>
      <div className="flex-1">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-sm text-white opacity-80 mt-1">{description}</p>
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
      {!isAdmin && !loading && currentUser && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6 text-center">トップページ</h1>
          <section>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4">メニュー</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MenuCard href="/mypage" icon={<MyPageIcon />} title="マイページ" description="プロフィールや契約情報" colorClass="bg-gradient-to-br from-blue-500 to-blue-600" />
              <MenuCard href="/curriculums" icon={<CurriculumIcon />} title="学習カリキュラム" description="今日のタスクと進捗" colorClass="bg-gradient-to-br from-purple-500 to-purple-600" />
              <MenuCard href="/classes" icon={<AttendClassIcon />} title="毎日個別特訓に参加する" description="オンライン講義に参加" colorClass="bg-gradient-to-br from-green-500 to-green-600" />
              <MenuCard href="/specials" icon={<SpecialCourseIcon />} title="特別講座" description="期間限定の講座に申込" colorClass="bg-gradient-to-br from-pink-500 to-pink-600" />
              <MenuCard href="/timeline" icon={<TimelineIcon />} title="お知らせタイムライン" description="運営からのお知らせを確認" colorClass="bg-gradient-to-br from-cyan-500 to-cyan-600" />
            </div>
          </section>
        </div>
      )}

      {(loading || isAdmin) && (
        <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {loading ? (
            <div className="h-48 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6 text-center">トップページ</h1>
              <section>
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4">管理者メニュー</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MenuCard href="/admin/students" icon={<StudentListIcon />} title="生徒一覧" description="担当生徒の情報を管理" colorClass="bg-gradient-to-br from-yellow-500 to-yellow-600" />
                  <MenuCard href="/admin/classes" icon={<OpenClassIcon />} title="特訓管理" description="特訓の開催と入室管理" colorClass="bg-gradient-to-br from-teal-500 to-teal-600" />
                  <MenuCard href="/admin/attendance" icon={<AttendanceIcon />} title="出席管理" description="出席予想と過去の出席実績" colorClass="bg-gradient-to-br from-emerald-500 to-emerald-600" />
                  <MenuCard href="/admin/specials" icon={<SpecialCourseIcon />} title="特別講座" description="特別講座の作成と管理" colorClass="bg-gradient-to-br from-indigo-500 to-indigo-600" />
                  <MenuCard href="/admin/personal-entries" icon={<PersonalLectureIcon />} title="個別講義管理" description="個別指導の申込を管理" colorClass="bg-gradient-to-br from-lime-500 to-lime-600" />
                  <MenuCard href="/admin/surveys" icon={<SurveyIcon />} title="アンケート管理" description="全生徒向けアンケートを作成・管理" colorClass="bg-gradient-to-br from-sky-500 to-sky-600" />
                  <MenuCard href="/admin/unpaid" icon={<UnpaidIcon />} title="未払い管理" description="契約更新が必要な生徒" colorClass="bg-gradient-to-br from-orange-500 to-orange-600" />
                  <MenuCard href="/admin/labor-cost" icon={<LaborCostIcon />} title="人件費管理" description="人件費率と予測の管理" colorClass="bg-gradient-to-br from-rose-500 to-rose-600" />
                  <MenuCard href="/admin/posts" icon={<PostAdminIcon />} title="記事管理" description="お知らせ記事の編集・削除" colorClass="bg-gradient-to-br from-slate-600 to-slate-700" />
                  <MenuCard href="/timeline" icon={<TimelineIcon />} title="お知らせタイムライン" description="運営からのお知らせを確認" colorClass="bg-gradient-to-br from-cyan-500 to-cyan-600" />
                  {currentUser?.role === 'super' && (
                    <MenuCard href="/admin/instructors" icon={<InstructorListIcon />} title="講師一覧" description="講師の招待と管理" colorClass="bg-gradient-to-br from-red-500 to-red-600" />
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {!loading && !currentUser && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">FAST-UP</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">塾生管理アプリへようこそ</p>
          <Link href="/login" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors">
            ログインして始める
          </Link>
        </div>
      )}
    </div>
  );
}
