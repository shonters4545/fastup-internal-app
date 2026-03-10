'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

const DAYS_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土'];

type MonthData = {
  year: number;
  month: number; // 0-indexed
  isConfirmed: boolean;
  deadlineMessage: string;
};

export default function AttendancePlanPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeDayOfWeek, setActiveDayOfWeek] = useState<number | null>(null);

  // Determine which months to display
  const visibleMonths = useMemo((): MonthData[] => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const result: MonthData[] = [];

    // Current month (always confirmed)
    result.push({
      year: currentYear,
      month: currentMonth,
      isConfirmed: true,
      deadlineMessage: '確定済み',
    });

    // Next month
    const nextDate = new Date(currentYear, currentMonth + 1, 1);
    const nextMonthYear = nextDate.getFullYear();
    const nextMonth = nextDate.getMonth();

    if (currentDay <= 10) {
      result.push({
        year: nextMonthYear,
        month: nextMonth,
        isConfirmed: false,
        deadlineMessage: `${currentMonth + 1}月10日24時で確定されます`,
      });
    } else {
      result.push({
        year: nextMonthYear,
        month: nextMonth,
        isConfirmed: true,
        deadlineMessage: '確定済み',
      });

      const afterNextDate = new Date(currentYear, currentMonth + 2, 1);
      result.push({
        year: afterNextDate.getFullYear(),
        month: afterNextDate.getMonth(),
        isConfirmed: false,
        deadlineMessage: `${nextMonth + 1}月10日24時で確定されます`,
      });
    }

    return result;
  }, []);

  // Fetch existing plans
  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.push('/login');
      return;
    }

    const fetchPlans = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('attendance_plans')
          .select('date')
          .eq('user_id', currentUser.id);

        if (error) throw error;

        const dates = new Set<string>();
        data?.forEach((row: any) => {
          dates.add(row.date);
        });
        setSelectedDates(dates);
      } catch (err) {
        console.error('Failed to fetch plans:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, [authLoading, currentUser, router, supabase]);

  // Batch day-of-week selection (toggle, only for unconfirmed months)
  const handleDayOfWeekSelect = (dayIndex: number) => {
    const newSelected = new Set(selectedDates);
    const isTogglingOff = activeDayOfWeek === dayIndex;

    visibleMonths.forEach(m => {
      if (!m.isConfirmed) {
        const daysInMonth = new Date(m.year, m.month + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
          const date = new Date(m.year, m.month, i);
          if (date.getDay() === dayIndex) {
            const dateStr = `${m.year}-${String(m.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            if (isTogglingOff) {
              newSelected.delete(dateStr);
            } else {
              newSelected.add(dateStr);
            }
          }
        }
      }
    });

    setSelectedDates(newSelected);
    setActiveDayOfWeek(isTogglingOff ? null : dayIndex);
  };

  // Individual date toggle
  const toggleDate = (dateStr: string, isConfirmed: boolean) => {
    if (isConfirmed) return;

    const newSelected = new Set(selectedDates);
    if (newSelected.has(dateStr)) {
      newSelected.delete(dateStr);
    } else {
      newSelected.add(dateStr);
    }
    setSelectedDates(newSelected);
    setActiveDayOfWeek(null);
  };

  // Save handler
  const handleSave = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      // 1. Delete all existing plans for this user
      const { error: deleteError } = await (supabase.from('attendance_plans') as any)
        .delete()
        .eq('user_id', currentUser.id);

      if (deleteError) throw deleteError;

      // 2. Insert all currently selected dates
      if (selectedDates.size > 0) {
        const rows = Array.from(selectedDates).map(dateStr => ({
          user_id: currentUser.id,
          date: dateStr,
          planned: true,
        }));

        const { error: insertError } = await (supabase.from('attendance_plans') as any)
          .insert(rows);

        if (insertError) throw insertError;
      }

      alert('出席予定を保存しました。');
    } catch (err) {
      console.error('Save failed:', err);
      alert('保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const renderBatchSelector = () => (
    <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl mb-6 border border-blue-100 dark:border-blue-800 animate-fade-in">
      <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        未確定月の曜日を一括選択
      </h3>
      <div className="flex flex-wrap gap-2">
        {DAYS_OF_WEEK.map((day, idx) => (
          <button
            key={`batch-${day}`}
            onClick={() => handleDayOfWeekSelect(idx)}
            className={`flex-1 min-w-[50px] py-2 rounded-xl text-xs font-bold transition-all border-2 ${
              activeDayOfWeek === idx
                ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400'
            }`}
          >
            {day}曜
          </button>
        ))}
      </div>
      <p className="text-[10px] text-blue-500 mt-2 font-medium">※未確定のカレンダーにのみ適用されます</p>
    </div>
  );

  const renderCalendar = (monthData: MonthData) => {
    const { year, month, isConfirmed, deadlineMessage } = monthData;
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-11 w-11"></div>);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isSelected = selectedDates.has(dateStr);
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      days.push(
        <button
          key={dateStr}
          disabled={isConfirmed}
          onClick={() => toggleDate(dateStr, isConfirmed)}
          className={`h-11 w-11 flex items-center justify-center rounded-full text-sm font-medium transition-all relative ${
            isSelected
              ? isConfirmed ? 'bg-gray-400 text-white' : 'bg-blue-600 text-white shadow-md scale-110 z-10'
              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
          } ${isToday ? 'border-2 border-orange-400' : ''} ${isConfirmed ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          {i}
          {isToday && <span className="absolute -top-1 text-[8px] text-orange-500 font-bold">TODAY</span>}
          {isConfirmed && isSelected && <span className="absolute -bottom-1 text-[6px] text-white font-bold bg-gray-600 px-1 rounded-full">FIX</span>}
        </button>
      );
    }

    return (
      <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 mb-8 border transition-all ${isConfirmed ? 'border-gray-100 dark:border-gray-700 opacity-95 bg-gray-50/50' : 'border-blue-200 dark:border-blue-900 ring-2 ring-blue-500/10'}`}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {year}年 {month + 1}月
            </h2>
            {isConfirmed && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-block ${isConfirmed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {isConfirmed ? '確定済み' : '未確定'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS_OF_WEEK.map((d, idx) => (
            <div key={d} className={`text-center text-[10px] font-black py-1 ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-400'}`}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 justify-items-center">
          {days}
        </div>
        <p className="text-right text-[10px] text-gray-500 dark:text-gray-400 font-bold mt-3 italic">
          {deadlineMessage}
        </p>
      </div>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-lg mx-auto text-center p-12">
        <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500 font-bold">予定を読み込み中...</p>
      </div>
    );
  }

  const confirmedMonths = visibleMonths.filter(m => m.isConfirmed);
  const unconfirmedMonths = visibleMonths.filter(m => !m.isConfirmed);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 animate-fade-in pb-40">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          出席申請
        </h1>
        <p className="text-sm text-gray-500 mt-2 font-medium leading-relaxed">
          毎日個別特訓に参加する日程をタップして選択してください。<br />
          <span className="text-blue-600 dark:text-blue-400 font-bold">※毎月10日</span>に翌月分が確定されます。
        </p>
      </div>

      {/* Confirmed months */}
      {confirmedMonths.map(month => (
        <div key={`${month.year}-${month.month}`}>
          {renderCalendar(month)}
        </div>
      ))}

      {/* Batch selector + unconfirmed months */}
      {unconfirmedMonths.length > 0 && (
        <>
          {renderBatchSelector()}
          {unconfirmedMonths.map(month => (
            <div key={`${month.year}-${month.month}`}>
              {renderCalendar(month)}
            </div>
          ))}
        </>
      )}

      {/* Fixed save button area */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t dark:border-gray-800 z-40 shadow-2xl">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-3 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500 font-bold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs font-black text-red-600 dark:text-red-400">※選択しただけでは反映されません。必ず保存してください。</p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="text-left bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-700">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">合計選択日数</p>
              <p className="text-xl font-black text-blue-600 dark:text-blue-400">{selectedDates.size}<span className="text-xs ml-1 font-normal text-gray-400">日</span></p>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-blue-500/30 transition-all active:scale-95 disabled:bg-gray-400 flex items-center justify-center gap-2 group"
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                  保存中...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  予定を保存する
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
