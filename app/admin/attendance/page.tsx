'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type StudentHistory = {
  id: string;
  nickname: string;
  plannedDates: Set<string>;
  actualDates: Set<string>;
  is3DayAbsent: boolean;
  hasPlannedAbsence: boolean;
  hasUnplannedAttendance: boolean;
};

type MonthData = {
  year: number;
  month: number;
  isConfirmed: boolean;
  deadlineMessage: string;
};

type PlannedStudent = {
  userId: string;
  nickname: string;
  stream?: string | null;
};

type ShiftInfo = {
  total: number;
  scienceCount: number;
  totalRooms: number;
  scienceRooms: number;
  humanitiesRooms: number;
};

const DAYS_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土'];

// シフト計算関数
function calcShiftInfo(students: PlannedStudent[]): ShiftInfo {
  const total = students.length;
  const scienceCount = students.filter(s => s.stream === 'science').length;
  const totalRooms = Math.ceil(total / 10);
  const scienceRooms = Math.ceil((scienceCount * 0.5) / 10);
  const humanitiesRooms = Math.max(totalRooms - scienceRooms, 0);
  return { total, scienceCount, totalRooms, scienceRooms, humanitiesRooms };
}

// --- Student List Modal ---
function StudentListModal({
  date,
  students,
  onClose,
}: {
  date: string;
  students: PlannedStudent[];
  onClose: () => void;
}) {
  const shift = calcShiftInfo(students);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-success-600 p-6 text-white text-center">
          <h3 className="text-xl font-black">{date}</h3>
          <p className="text-success-100 text-sm font-bold mt-1">出席予定の生徒一覧</p>
        </div>

        {/* シフトサポート情報 */}
        {students.length > 0 && (
          <div className="mx-6 mt-4 p-4 bg-primary-50 dark:bg-gray-900/30 rounded-xl border border-accent-300 dark:border-gray-800">
            <h4 className="text-xs font-black text-primary-600 dark:text-gray-400 mb-2 uppercase">シフトサポート</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-600 dark:text-gray-300">出席予定者:</div>
              <div className="font-bold text-gray-800 dark:text-gray-100">{shift.total}名 (理系: {shift.scienceCount}名)</div>
              <div className="text-gray-600 dark:text-gray-300">想定ルーム数:</div>
              <div className="font-bold text-gray-800 dark:text-gray-100">{shift.totalRooms} (文系: {shift.humanitiesRooms} / 理系: {shift.scienceRooms})</div>
              <div className="text-gray-600 dark:text-gray-300">必要講師数:</div>
              <div className="font-bold text-gray-800 dark:text-gray-100">{shift.totalRooms}名</div>
            </div>
          </div>
        )}

        <div className="p-6">
          {students.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {students.map((s) => (
                <Link
                  key={s.userId}
                  href={`/admin/student/${s.userId}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-success-50 dark:hover:bg-success-900/30 transition-colors border border-gray-50 dark:border-gray-700 group"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 dark:text-gray-100 group-hover:text-success-600 dark:group-hover:text-success-400">
                      {s.nickname}
                    </span>
                    {s.stream && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        s.stream === 'science' ? 'bg-info-100 text-info-700 dark:bg-info-900/40 dark:text-info-300' : 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300'
                      }`}>
                        {s.stream === 'science' ? '理系' : '文系'}
                      </span>
                    )}
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-gray-400 group-hover:text-success-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8 italic font-bold">
              予定されている生徒はいません
            </p>
          )}
          <button
            onClick={onClose}
            className="w-full mt-2 py-3 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-black rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function AdminAttendancePage() {
  const { currentUser, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<StudentHistory[]>([]);
  const [plannedMap, setPlannedMap] = useState<Map<string, PlannedStudent[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI States
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isForecastOpen, setIsForecastOpen] = useState(false);
  const [filterPlannedAbsence, setFilterPlannedAbsence] = useState(false);
  const [filterUnplannedAttendance, setFilterUnplannedAttendance] = useState(false);
  const [selectedDateDetails, setSelectedDateDetails] = useState<{
    date: string;
    students: PlannedStudent[];
  } | null>(null);

  // Visible months for calendar
  const visibleMonths = useMemo((): MonthData[] => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const result: MonthData[] = [];

    // Current month is always confirmed
    result.push({
      year: currentYear,
      month: currentMonth,
      isConfirmed: true,
      deadlineMessage: '確定済み',
    });

    // Next month: editable until end of current month (月末締め)
    const nextDate = new Date(currentYear, currentMonth + 1, 1);
    result.push({
      year: nextDate.getFullYear(),
      month: nextDate.getMonth(),
      isConfirmed: false,
      deadlineMessage: `${currentMonth + 1}月末日で確定されます`,
    });

    return result;
  }, []);

  // History dates: last 7 days
  const historyDates = useMemo(() => {
    const result = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      result.push(d.toISOString().split('T')[0]);
    }
    return result;
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      // 1. Get student users (with stream info)
      const { data: studentUsers, error: studentsError } = await (supabase.from('users') as any)
        .select('id, nickname, stream')
        .eq('role', 'student');

      if (studentsError) throw studentsError;

      const studentList = (studentUsers || []).map((u: any) => ({
        id: u.id,
        nickname: u.nickname || '（名前未設定）',
        stream: u.stream || null,
      }));

      // 2. Get attendance records (recent classes)
      const { data: recentClasses } = await (supabase.from('classes') as any)
        .select('id, start_time')
        .gte('start_time', sevenDaysAgo.toISOString())
        .order('start_time', { ascending: false });

      const classIds = (recentClasses || []).map((c: any) => c.id);
      const classDateMap = new Map<string, string>();
      (recentClasses || []).forEach((c: any) => {
        classDateMap.set(c.id, new Date(c.start_time).toISOString().split('T')[0]);
      });

      let actualMap = new Map<string, Set<string>>();
      if (classIds.length > 0) {
        const { data: records } = await (supabase.from('attendance_records') as any)
          .select('user_id, class_id')
          .in('class_id', classIds);

        (records || []).forEach((r: any) => {
          const dateKey = classDateMap.get(r.class_id);
          if (dateKey) {
            if (!actualMap.has(r.user_id)) actualMap.set(r.user_id, new Set());
            actualMap.get(r.user_id)!.add(dateKey);
          }
        });
      }

      // 3. Get all attendance plans
      const { data: plans } = await (supabase.from('attendance_plans') as any)
        .select('user_id, date');

      const studentPlannedDates = new Map<string, Set<string>>();
      const globalPlannedMap = new Map<string, PlannedStudent[]>();

      (plans || []).forEach((plan: any) => {
        const student = studentList.find((s: any) => s.id === plan.user_id);
        if (student) {
          const dateStr = plan.date; // date column is already YYYY-MM-DD
          if (!studentPlannedDates.has(plan.user_id))
            studentPlannedDates.set(plan.user_id, new Set());
          studentPlannedDates.get(plan.user_id)!.add(dateStr);

          if (!globalPlannedMap.has(dateStr)) globalPlannedMap.set(dateStr, []);
          globalPlannedMap.get(dateStr)!.push({
            userId: student.id,
            nickname: student.nickname,
            stream: student.stream,
          });
        }
      });
      setPlannedMap(globalPlannedMap);

      // 4. Process history for each student
      const processedHistory: StudentHistory[] = studentList.map((student: any) => {
        const pDates = studentPlannedDates.get(student.id) || new Set<string>();
        const aDates = actualMap.get(student.id) || new Set<string>();

        const is3DayAbsent =
          !aDates.has(historyDates[0]) &&
          !aDates.has(historyDates[1]) &&
          !aDates.has(historyDates[2]);

        let hasPlannedAbsence = false;
        let hasUnplannedAttendance = false;
        historyDates.forEach((d) => {
          if (pDates.has(d) && !aDates.has(d)) hasPlannedAbsence = true;
          if (!pDates.has(d) && aDates.has(d)) hasUnplannedAttendance = true;
        });

        return {
          id: student.id,
          nickname: student.nickname,
          plannedDates: pDates,
          actualDates: aDates,
          is3DayAbsent,
          hasPlannedAbsence,
          hasUnplannedAttendance,
        };
      });

      setStudents(processedHistory);
    } catch (err) {
      console.error('Failed to fetch attendance data:', err);
      setError('データの取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && currentUser && ['admin', 'super'].includes(currentUser.role || '')) {
      fetchData();
    } else if (!authLoading) {
      setError('権限がありません。');
      setLoading(false);
    }
  }, [currentUser, authLoading]);

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      if (a.is3DayAbsent !== b.is3DayAbsent) return a.is3DayAbsent ? -1 : 1;
      if (filterPlannedAbsence) {
        if (a.hasPlannedAbsence !== b.hasPlannedAbsence) return a.hasPlannedAbsence ? -1 : 1;
      }
      if (filterUnplannedAttendance) {
        if (a.hasUnplannedAttendance !== b.hasUnplannedAttendance)
          return a.hasUnplannedAttendance ? -1 : 1;
      }
      return a.nickname.localeCompare(b.nickname);
    });
  }, [students, filterPlannedAbsence, filterUnplannedAttendance]);

  const renderCalendar = (monthData: MonthData) => {
    const { year, month, isConfirmed, deadlineMessage } = monthData;
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-14 w-14"></div>);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const plannedStudents = plannedMap.get(dateStr) || [];
      const count = plannedStudents.length;
      const shift = count > 0 ? calcShiftInfo(plannedStudents) : null;

      days.push(
        <button
          key={dateStr}
          onClick={() => setSelectedDateDetails({ date: dateStr, students: plannedStudents })}
          className={`h-14 w-14 flex flex-col items-center justify-center rounded-xl text-xs font-bold transition-all relative ${
            count > 0
              ? isConfirmed
                ? 'bg-success-500 text-white shadow-sm'
                : 'bg-primary-400 text-white'
              : 'bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500'
          } hover:scale-110 active:scale-95`}
        >
          <span>{i}</span>
          {count > 0 && (
            <>
              <span className="text-[8px] opacity-80 leading-none mt-0.5">{count}名</span>
              {shift && shift.totalRooms > 0 && (
                <span className="text-[7px] opacity-70 leading-none">R{shift.totalRooms}/講{shift.totalRooms}</span>
              )}
            </>
          )}
        </button>
      );
    }

    return (
      <div
        className={`bg-gray-50 dark:bg-gray-950/40 p-5 rounded-2xl border ${isConfirmed ? 'border-success-100 dark:border-success-900/30' : 'border-gray-200 dark:border-gray-700'}`}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-black text-gray-800 dark:text-gray-100">
            {year}年 {month + 1}月
          </h3>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-badge font-black ${isConfirmed ? 'bg-success-100 text-success-700' : 'bg-primary-100 text-gray-700'}`}
          >
            {isConfirmed ? '確定済み' : '未確定'}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {DAYS_OF_WEEK.map((d, idx) => (
            <div
              key={d}
              className={`text-center text-[10px] font-black ${idx === 0 ? 'text-danger-500' : idx === 6 ? 'text-primary-500' : 'text-gray-400'}`}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 justify-items-center">{days}</div>
        {!isConfirmed && (
          <p className="text-right text-[9px] text-primary-500 font-bold mt-3">
            ※{deadlineMessage}
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="w-full max-w-6xl text-center p-20 mx-auto mt-8">
        <div className="spinner mx-auto mb-4"></div>
        <p className="text-gray-500 font-black">出席データを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mt-8 mx-auto px-4 pb-40 relative">
      <div>
        <div className="flex justify-between items-center mb-8 border-b dark:border-gray-800 pb-4">
          <h1 className="text-3xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-success-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
            出席管理
          </h1>
          <Link
            href="/"
            className="text-sm font-black text-primary-600 dark:text-gray-400 hover:underline"
          >
            ダッシュボードへ &rarr;
          </Link>
        </div>

        {/* History Section */}
        <section className="mb-12">
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="w-full bg-white dark:bg-gray-900 hover:shadow-card p-5 rounded-card flex justify-between items-center transition-all border border-gray-50 dark:border-gray-800 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="bg-success-100 dark:bg-success-900/30 p-2 rounded-xl">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-5 w-5 text-success-600 transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-black text-gray-800 dark:text-gray-100">
                出席実績 (直近7日間)
              </h2>
            </div>
            {students.some((s) => s.is3DayAbsent) && !isHistoryOpen && (
              <span className="bg-danger-500 text-white text-[10px] px-3 py-1 rounded-badge font-black animate-bounce">
                アラートあり
              </span>
            )}
          </button>

          {isHistoryOpen && (
            <div className="mt-4 space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-4 bg-gray-50 dark:bg-gray-950/40 p-4 rounded-card border border-gray-50 dark:border-gray-800">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filterPlannedAbsence}
                    onChange={(e) => setFilterPlannedAbsence(e.target.checked)}
                    className="w-4 h-4 text-danger-600 rounded border-gray-300 focus:ring-danger-500"
                  />
                  <span className="text-sm font-bold text-gray-600 dark:text-gray-300 group-hover:text-danger-600 transition-colors">
                    申請済みの欠席を目立たせる
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filterUnplannedAttendance}
                    onChange={(e) => setFilterUnplannedAttendance(e.target.checked)}
                    className="w-4 h-4 text-warning-600 rounded border-gray-300 focus:ring-warning-500"
                  />
                  <span className="text-sm font-bold text-gray-600 dark:text-gray-300 group-hover:text-warning-600 transition-colors">
                    未申請の出席を目立たせる
                  </span>
                </label>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-card overflow-hidden border border-gray-50 dark:border-gray-800">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-6 py-4 text-left text-xs font-black text-gray-500 dark:text-gray-300 uppercase tracking-wider min-w-[160px]">
                          生徒名
                        </th>
                        {historyDates.map((date, index) => (
                          <th
                            key={date}
                            className="px-3 py-4 text-center text-xs font-black text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                          >
                            <div className="flex flex-col items-center">
                              <span>
                                {new Date(date + 'T00:00:00').toLocaleDateString('ja-JP', {
                                  month: 'numeric',
                                  day: 'numeric',
                                })}
                              </span>
                              {index === 0 && (
                                <span className="text-[9px] text-primary-500 font-bold">本日</span>
                              )}
                            </div>
                          </th>
                        ))}
                        <th className="px-4 py-4 text-center text-xs font-black text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          状態
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800 font-mono">
                      {sortedStudents.map((student) => {
                        const nameStyle =
                          filterPlannedAbsence && student.hasPlannedAbsence
                            ? 'text-danger-600 font-black'
                            : filterUnplannedAttendance && student.hasUnplannedAttendance
                            ? 'text-warning-500 font-black'
                            : 'text-gray-800 dark:text-gray-100 font-bold';

                        return (
                          <tr
                            key={student.id}
                            className={`transition-colors ${student.is3DayAbsent ? 'bg-danger-50 dark:bg-danger-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                          >
                            <td className="sticky left-0 z-10 px-6 py-4 whitespace-nowrap text-sm bg-inherit border-r dark:border-gray-800">
                              <Link
                                href={`/admin/student/${student.id}`}
                                className={`${nameStyle} hover:underline`}
                              >
                                {student.nickname}
                              </Link>
                            </td>
                            {historyDates.map((date) => {
                              const isPlanned = student.plannedDates.has(date);
                              const isActual = student.actualDates.has(date);
                              const cellBg = isPlanned
                                ? 'bg-success-200 dark:bg-success-900/60'
                                : 'bg-gray-50 dark:bg-gray-800/40';

                              return (
                                <td
                                  key={date}
                                  className={`px-3 py-4 whitespace-nowrap text-center ${cellBg} border-r border-white dark:border-gray-800/50 last:border-r-0`}
                                >
                                  {isActual ? (
                                    <span className="text-success-800 dark:text-success-400 font-black text-lg">
                                      ○
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500 font-medium text-lg">
                                      ×
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              {student.is3DayAbsent && (
                                <span className="text-[10px] font-black text-danger-600 bg-danger-100 px-2.5 py-1 rounded-badge border border-danger-200 animate-pulse">
                                  3日連続欠席アラート
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-800 flex flex-wrap gap-6 items-center text-[10px] font-bold text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-success-200 dark:bg-success-900/60 rounded border border-success-300"></span>{' '}
                    出席予定あり
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-gray-50 dark:bg-gray-800/40 rounded border border-gray-200"></span>{' '}
                    出席予定なし
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-success-800 font-black">○</span> 実際に出席
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400">×</span> 欠席
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Forecast Section */}
        <section>
          <button
            onClick={() => setIsForecastOpen(!isForecastOpen)}
            className="w-full bg-white dark:bg-gray-900 hover:shadow-card p-5 rounded-card flex justify-between items-center transition-all border border-gray-50 dark:border-gray-800 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="bg-primary-100 dark:bg-gray-900/30 p-2 rounded-xl">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-5 w-5 text-primary-600 transition-transform ${isForecastOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-black text-gray-800 dark:text-gray-100">
                今後の出席予想
              </h2>
            </div>
          </button>

          {isForecastOpen && (
            <div className="mt-4 bg-white dark:bg-gray-900 rounded-3xl shadow-card p-6 border border-gray-50 dark:border-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {visibleMonths.map((m, idx) => (
                  <div key={`${m.year}-${m.month}-${idx}`}>{renderCalendar(m)}</div>
                ))}
              </div>
              <div className="mt-8 p-4 bg-success-50 dark:bg-success-900/20 rounded-card border border-success-100 dark:border-success-800 flex items-start gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-success-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-xs text-success-800 dark:text-success-300 font-bold leading-relaxed">
                  カレンダーの日付をタップすると、その日に出席予定の生徒名を確認できます。緑色の日付は確定済み、青色の日付はまだ生徒が変更可能な期間です。
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {selectedDateDetails && (
        <StudentListModal
          date={selectedDateDetails.date}
          students={selectedDateDetails.students}
          onClose={() => setSelectedDateDetails(null)}
        />
      )}
    </div>
  );
}
