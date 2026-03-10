'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Constants
const INSTRUCTOR_REWARD_PER_SHIFT = 4500;
const STUDENT_UNIT_PRICE = 49800;
const LABOR_COST_BUDGET_RATIO = 0.2;
const STUDENTS_PER_INSTRUCTOR_TARGET = 12;

type DailyMetric = {
  date: string;
  totalStudentCount: number;
  attendingStudentCount: number;
  attendingInstructorCount: number;
  laborCost: number;
  laborCostRatio: number;
  studentsPerInstructor: number;
  isPredicted?: boolean;
};

type DashboardData = {
  currentLaborCostSum: number;
  remainingBudget: number;
  totalBudget: number;
  predictedLaborCostSum: number;
  remainingShifts: number;
  totalShiftsLimit: number;
  currentShifts: number;
  predictedShifts: number;
  averageShiftGuideline: number;
  predictedAverageShift: number;
  totalLaborCostRatio: number;
  averageStudentsPerInstructor: number;
  currentTotalStudents: number;
};

export default function AdminLaborCostPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  const today = new Date();

  // Month selection options (last 12 months)
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthOptions.push(d);
  }

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = ('0' + (date.getMonth() + 1)).slice(-2);
    const d = ('0' + date.getDate()).slice(-2);
    return `${y}-${m}-${d}`;
  };

  const calculateDashboardData = (
    metrics: DailyMetric[],
    daysInMonth: number,
    _isCurrentMonth: boolean
  ) => {
    const currentMetrics = metrics.filter((m) => !m.isPredicted);
    const predictedMetrics = metrics.filter((m) => m.isPredicted);

    const currentLaborCostSum = currentMetrics.reduce((sum, m) => sum + m.laborCost, 0);
    const currentTotalStudents =
      currentMetrics.length > 0
        ? currentMetrics[currentMetrics.length - 1].totalStudentCount
        : 0;

    const budget = currentTotalStudents * STUDENT_UNIT_PRICE * LABOR_COST_BUDGET_RATIO;
    const remainingBudget = budget - currentLaborCostSum;
    const totalBudget = budget;

    const predictedLaborCostSum = predictedMetrics.reduce((sum, m) => sum + m.laborCost, 0);
    const remainingShifts = remainingBudget / INSTRUCTOR_REWARD_PER_SHIFT;
    const totalShiftsLimit = totalBudget / INSTRUCTOR_REWARD_PER_SHIFT;
    const currentShifts = currentLaborCostSum / INSTRUCTOR_REWARD_PER_SHIFT;
    const predictedShifts = predictedLaborCostSum / INSTRUCTOR_REWARD_PER_SHIFT;

    const daysLeft = Math.max(0, daysInMonth - currentMetrics.length);
    const averageShiftGuideline = daysLeft > 0 ? remainingShifts / daysLeft : 0;
    const predictedAverageShift = daysLeft > 0 ? predictedShifts / daysLeft : 0;

    const daysElapsed = currentMetrics.length;
    const totalLaborCost = currentLaborCostSum;
    const revenueBase =
      currentTotalStudents * STUDENT_UNIT_PRICE * (daysElapsed / daysInMonth);
    const totalLaborCostRatio = revenueBase > 0 ? (totalLaborCost / revenueBase) * 100 : 0;

    const totalAttendingStudents = currentMetrics.reduce(
      (sum, m) => sum + m.attendingStudentCount,
      0
    );
    const totalAttendingInstructors = currentMetrics.reduce(
      (sum, m) => sum + m.attendingInstructorCount,
      0
    );
    const averageStudentsPerInstructor =
      totalAttendingInstructors > 0 ? totalAttendingStudents / totalAttendingInstructors : 0;

    setDashboardData({
      currentLaborCostSum,
      remainingBudget,
      totalBudget,
      predictedLaborCostSum,
      remainingShifts,
      totalShiftsLimit,
      currentShifts,
      predictedShifts,
      averageShiftGuideline,
      predictedAverageShift,
      totalLaborCostRatio,
      averageStudentsPerInstructor,
      currentTotalStudents,
    });
  };

  useEffect(() => {
    if (authLoading || !currentUser) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const startOfMonth = new Date(
          selectedMonth.getFullYear(),
          selectedMonth.getMonth(),
          1
        );
        const endOfMonth = new Date(
          selectedMonth.getFullYear(),
          selectedMonth.getMonth() + 1,
          0,
          23,
          59,
          59
        );
        const daysInMonth = endOfMonth.getDate();
        const isCurrentMonth =
          selectedMonth.getMonth() === today.getMonth() &&
          selectedMonth.getFullYear() === today.getFullYear();

        // Get active student count
        const { data: studentUsers } = await (supabase.from('users') as any)
          .select('id, created_at')
          .eq('role', 'student');

        const { data: activeContracts } = await (supabase.from('contracts') as any)
          .select('user_id')
          .eq('status', 'active');

        const activeUserIds = new Set(
          (activeContracts || []).map((c: any) => c.user_id)
        );

        // Get classes in the month
        const { data: classesInMonth } = await (supabase.from('classes') as any)
          .select('id, start_time')
          .gte('start_time', startOfMonth.toISOString())
          .lte('start_time', endOfMonth.toISOString());

        const classDateMap = new Map<string, string[]>();
        (classesInMonth || []).forEach((c: any) => {
          const dateKey = formatDate(new Date(c.start_time));
          if (!classDateMap.has(dateKey)) classDateMap.set(dateKey, []);
          classDateMap.get(dateKey)!.push(c.id);
        });

        // Get attendance records for the month's classes
        const allClassIds = (classesInMonth || []).map((c: any) => c.id);
        let attendanceByClass = new Map<string, Set<string>>();
        if (allClassIds.length > 0) {
          const { data: records } = await (supabase.from('attendance_records') as any)
            .select('class_id, user_id')
            .in('class_id', allClassIds);

          (records || []).forEach((r: any) => {
            if (!attendanceByClass.has(r.class_id))
              attendanceByClass.set(r.class_id, new Set());
            attendanceByClass.get(r.class_id)!.add(r.user_id);
          });
        }

        // Get attendance plans for future prediction
        const { data: plans } = await (supabase.from('attendance_plans') as any)
          .select('user_id, date')
          .gte('date', formatDate(startOfMonth))
          .lte('date', formatDate(endOfMonth));

        const plansByDate = new Map<string, Set<string>>();
        (plans || []).forEach((p: any) => {
          if (!plansByDate.has(p.date)) plansByDate.set(p.date, new Set());
          plansByDate.get(p.date)!.add(p.user_id);
        });

        // Calculate daily metrics
        const calculatedMetrics: DailyMetric[] = [];
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        for (let d = 1; d <= daysInMonth; d++) {
          const currentDate = new Date(
            selectedMonth.getFullYear(),
            selectedMonth.getMonth(),
            d
          );
          const dateKey = formatDate(currentDate);
          const isPast = currentDate < todayDate;
          const isFuture = currentDate > todayDate;

          // Total students: created before end of day & has active contract
          const endOfDay = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            d,
            23,
            59,
            59
          );
          const totalStudentCount = (studentUsers || []).filter((u: any) => {
            const createdAt = new Date(u.created_at);
            return createdAt <= endOfDay && activeUserIds.has(u.id);
          }).length;

          let attendingStudentCount = 0;
          let attendingInstructorCount = 0;
          let isPredicted = false;

          if (isFuture) {
            isPredicted = true;
            const plannedStudents = plansByDate.get(dateKey);
            attendingStudentCount = plannedStudents ? plannedStudents.size : 0;
            attendingInstructorCount = Math.ceil(
              attendingStudentCount / STUDENTS_PER_INSTRUCTOR_TARGET
            );
          } else {
            // Past or today: use actual data
            const classIdsForDay = classDateMap.get(dateKey) || [];
            const uniqueStudents = new Set<string>();
            classIdsForDay.forEach((classId) => {
              const students = attendanceByClass.get(classId);
              if (students) students.forEach((s) => uniqueStudents.add(s));
            });
            attendingStudentCount = uniqueStudents.size;
            // Estimate instructor count: 1 per 12 students (or use class count as proxy)
            attendingInstructorCount = classIdsForDay.length > 0
              ? Math.max(classIdsForDay.length, Math.ceil(attendingStudentCount / STUDENTS_PER_INSTRUCTOR_TARGET))
              : 0;
          }

          const laborCost = attendingInstructorCount * INSTRUCTOR_REWARD_PER_SHIFT;
          const dailyRevenue = (totalStudentCount * STUDENT_UNIT_PRICE) / daysInMonth;
          const laborCostRatio =
            dailyRevenue > 0 ? (laborCost / dailyRevenue) * 100 : 0;
          const studentsPerInstructor =
            attendingInstructorCount > 0
              ? attendingStudentCount / attendingInstructorCount
              : 0;

          calculatedMetrics.push({
            date: dateKey,
            totalStudentCount,
            attendingStudentCount,
            attendingInstructorCount,
            laborCost,
            laborCostRatio,
            studentsPerInstructor,
            isPredicted,
          });
        }

        setDailyMetrics(calculatedMetrics);
        calculateDashboardData(calculatedMetrics, daysInMonth, isCurrentMonth);
      } catch (err) {
        console.error('Error fetching labor cost data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedMonth, authLoading, currentUser]);

  const handleInstructorCountChange = (dateKey: string, newCountStr: string) => {
    const newCount = parseInt(newCountStr, 10);
    if (isNaN(newCount) || newCount < 0) return;

    const endOfMonth = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth() + 1,
      0
    );
    const daysInMonth = endOfMonth.getDate();

    const updatedMetrics = dailyMetrics.map((metric) => {
      if (metric.date !== dateKey) return metric;

      const laborCost = newCount * INSTRUCTOR_REWARD_PER_SHIFT;
      const dailyRevenue = (metric.totalStudentCount * STUDENT_UNIT_PRICE) / daysInMonth;
      const laborCostRatio = dailyRevenue > 0 ? (laborCost / dailyRevenue) * 100 : 0;
      const studentsPerInstructor =
        newCount > 0 ? metric.attendingStudentCount / newCount : 0;

      return {
        ...metric,
        attendingInstructorCount: newCount,
        laborCost,
        laborCostRatio,
        studentsPerInstructor,
        isPredicted: false,
      };
    });

    setDailyMetrics(updatedMetrics);

    const isCurrentMonth =
      selectedMonth.getMonth() === new Date().getMonth() &&
      selectedMonth.getFullYear() === new Date().getFullYear();
    calculateDashboardData(updatedMetrics, daysInMonth, isCurrentMonth);
  };

  const getLaborCostRatioColor = (ratio: number) => {
    if (ratio >= 20) return 'text-red-600 bg-red-100';
    if (ratio >= 18) return 'text-green-600 bg-green-100';
    return 'text-blue-600 bg-blue-100';
  };

  const getStudentsPerInstructorColor = (num: number) => {
    if (num >= 12) return 'text-red-600 bg-red-100';
    if (num >= 10) return 'text-green-600 bg-green-100';
    return 'text-blue-600 bg-blue-100';
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">人件費管理</h1>
        <select
          className="p-2 border rounded-md shadow-sm text-gray-700 dark:text-white dark:bg-gray-700 dark:border-gray-600"
          value={selectedMonth.toISOString()}
          onChange={(e) => setSelectedMonth(new Date(e.target.value))}
        >
          {monthOptions.map((date) => (
            <option key={date.toISOString()} value={date.toISOString()}>
              {date.getFullYear()}年{date.getMonth() + 1}月
            </option>
          ))}
        </select>
      </div>

      {/* Dashboard */}
      {dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Remaining Cost */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">
              残コスト
            </h3>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              ¥{Math.floor(dashboardData.remainingBudget).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mb-2">
              上限: ¥{Math.floor(dashboardData.totalBudget).toLocaleString()}
            </p>
            <div className="mt-2 text-sm text-gray-500 border-t pt-2 dark:border-gray-700">
              <p>現時点: ¥{dashboardData.currentLaborCostSum.toLocaleString()}</p>
              <p
                className={
                  dashboardData.predictedLaborCostSum > dashboardData.remainingBudget
                    ? 'text-red-500 font-bold'
                    : ''
                }
              >
                予想: ¥{dashboardData.predictedLaborCostSum.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Remaining Shifts */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">
              残りシフト数
            </h3>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {Math.floor(dashboardData.remainingShifts)}枠
            </p>
            <p className="text-xs text-gray-400 mb-2">
              上限: {Math.floor(dashboardData.totalShiftsLimit)}枠
            </p>
            <div className="mt-2 text-sm text-gray-500 border-t pt-2 dark:border-gray-700">
              <p>現時点: {Math.floor(dashboardData.currentShifts)}枠</p>
              <p
                className={
                  dashboardData.predictedShifts > dashboardData.remainingShifts
                    ? 'text-red-500 font-bold'
                    : ''
                }
              >
                予想: {Math.ceil(dashboardData.predictedShifts)}枠
              </p>
            </div>
          </div>

          {/* Average Shift Guide */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">
              平均シフト目安/日
            </h3>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {dashboardData.averageShiftGuideline.toFixed(1)}枠
            </p>
            <div className="mt-2 text-sm text-gray-500 border-t pt-2 dark:border-gray-700">
              <p
                className={
                  dashboardData.predictedAverageShift > dashboardData.averageShiftGuideline
                    ? 'text-red-500 font-bold'
                    : ''
                }
              >
                予想: {dashboardData.predictedAverageShift.toFixed(1)}枠
              </p>
            </div>
          </div>

          {/* Labor Cost Ratio & Students Per Instructor */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-1">
                人件費率
              </h3>
              <div
                className={`text-2xl font-bold px-2 py-1 rounded inline-block ${getLaborCostRatioColor(dashboardData.totalLaborCostRatio)}`}
              >
                {dashboardData.totalLaborCostRatio.toFixed(1)}%
              </div>
              <p className="text-xs text-gray-400">目標: 18%以下</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-1">
                平均担当人数
              </h3>
              <div
                className={`text-2xl font-bold px-2 py-1 rounded inline-block ${getStudentsPerInstructorColor(dashboardData.averageStudentsPerInstructor)}`}
              >
                {dashboardData.averageStudentsPerInstructor.toFixed(1)}人
              </div>
              <p className="text-xs text-gray-400">目標: 10人以下</p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  日付
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  総塾生数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  特訓参加生徒
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  特訓参加講師
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  人件費
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  人件費率
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  担当人数
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {dailyMetrics.map((metric) => (
                <tr
                  key={metric.date}
                  className={metric.isPredicted ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {metric.date}{' '}
                    {metric.isPredicted && (
                      <span className="text-xs text-yellow-600">(予想)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {metric.totalStudentCount}人
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {metric.attendingStudentCount}人
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    <input
                      type="number"
                      min="0"
                      className="w-20 p-1 border rounded text-right dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      value={metric.attendingInstructorCount}
                      onChange={(e) =>
                        handleInstructorCountChange(metric.date, e.target.value)
                      }
                    />
                    <span className="ml-1">人</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    ¥{metric.laborCost.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 rounded ${getLaborCostRatioColor(metric.laborCostRatio)}`}
                    >
                      {metric.laborCostRatio.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 rounded ${getStudentsPerInstructorColor(metric.studentsPerInstructor)}`}
                    >
                      {metric.studentsPerInstructor.toFixed(1)}人
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
