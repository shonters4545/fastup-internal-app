'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

/**
 * AttendanceGate — 出席申請の提出を促す/強制するコンポーネント
 *
 * 20日〜25日: 通知モーダル（閉じれる、毎回表示）
 * 26日〜末日: ブロッキングモーダル（提出するまで閉じれない）
 * 翌月1日〜: 未提出者は引き続きブロック
 */
export function AttendanceGate() {
  const { currentUser, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [hasNextMonthPlan, setHasNextMonthPlan] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // 出席申請ページ自体、ログイン画面、管理者ページは除外
  const isExemptPage =
    pathname?.startsWith('/mypage/attendance') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/api');

  const isAdmin = currentUser && ['admin', 'super'].includes(currentUser.role);

  const checkAttendancePlan = useCallback(async () => {
    if (!currentUser || isAdmin || isExemptPage) {
      setChecking(false);
      return;
    }

    try {
      const supabase = createClient();
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextMonthYear = nextMonth.getFullYear();
      const nextMonthNum = nextMonth.getMonth() + 1;

      // 翌月の出席予定を1件でも持っているか確認
      const startDate = `${nextMonthYear}-${String(nextMonthNum).padStart(2, '0')}-01`;
      const lastDay = new Date(nextMonthYear, nextMonth.getMonth() + 1, 0).getDate();
      const endDate = `${nextMonthYear}-${String(nextMonthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('attendance_plans')
        .select('id')
        .eq('user_id', currentUser.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .limit(1);

      if (error) {
        console.error('AttendanceGate check failed:', error);
        setHasNextMonthPlan(true); // エラー時はブロックしない
      } else {
        setHasNextMonthPlan(data && data.length > 0);
      }
    } catch (err) {
      console.error('AttendanceGate error:', err);
      setHasNextMonthPlan(true);
    } finally {
      setChecking(false);
    }
  }, [currentUser, isAdmin, isExemptPage]);

  useEffect(() => {
    if (!authLoading) {
      checkAttendancePlan();
    }
  }, [authLoading, checkAttendancePlan, pathname]);

  // 表示判定
  if (authLoading || checking || !currentUser || isAdmin || isExemptPage || hasNextMonthPlan) {
    return null;
  }

  const now = new Date();
  const dayOfMonth = now.getDate();

  // 20日未満は何も表示しない
  if (dayOfMonth < 20) {
    return null;
  }

  const isBlocking = dayOfMonth >= 26; // 26日以降はブロッキング
  const nextMonthLabel = `${now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear()}年${(now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2)}月`;
  const deadlineLabel = `${now.getMonth() + 1}月25日`;

  // 通知モーダル（20-25日）で dismiss 済みなら表示しない
  if (!isBlocking && dismissed) {
    return null;
  }

  const handleGoToAttendance = () => {
    router.push('/mypage/attendance');
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="text-center mb-5">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
            isBlocking
              ? 'bg-danger-100 dark:bg-danger-900/30'
              : 'bg-warning-100 dark:bg-warning-900/30'
          }`}>
            {isBlocking ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-danger-600 dark:text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m-4.93-4A8 8 0 1120 12H4a8 8 0 01.07-4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-warning-600 dark:text-warning-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>

          <h2 className="text-xl font-black text-gray-800 dark:text-gray-100">
            {isBlocking ? '出席申請が必要です' : '出席申請の期限が近づいています'}
          </h2>

          {isBlocking ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
              {nextMonthLabel}の出席予定が未提出のため、<br />
              アプリの機能をご利用いただけません。
            </p>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
              {nextMonthLabel}の出席申請の締め切りは<br />
              <span className="font-bold text-warning-700 dark:text-warning-300">{deadlineLabel}</span>です。
            </p>
          )}
        </div>

        {/* デメリット説明 */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-5 space-y-3">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            出席申請が未提出の場合
          </p>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">コーチが割り当てられません</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                出席申請をもとにルーム振り分けを行うため、未申請の場合は待機教室（教室Z）への案内となります。
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">ポイントが加算されません</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                特訓参加でもらえるFAST-UPポイント（1回1pt）は、出席申請済みの場合のみ付与されます。ポイントを貯めるとご褒美と交換できます。
              </p>
            </div>
          </div>
        </div>

        {/* ボタン */}
        <div className="space-y-3">
          <button
            onClick={handleGoToAttendance}
            className="btn-primary w-full py-3.5 text-base font-bold rounded-xl shadow-lg shadow-primary-500/20"
          >
            今すぐ出席申請する
          </button>

          {!isBlocking && (
            <button
              onClick={handleDismiss}
              className="w-full py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              あとで
            </button>
          )}

          {isBlocking && (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500">
              ※参加しない月でも「0日」で登録が必要です
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
