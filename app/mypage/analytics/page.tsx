'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

type TimeRange = '7' | '30';

type AttendanceRecord = {
  id: string;
  className: string;
  attendedAt: Date;
};

type AnalyticsData = {
  totalTime: number;
  totalTasks: number;
  avgTimePerDay: number;
  dailyData: { day: string; time: number; fullDate: Date }[];
  subjectData: { subject: string; time: number }[];
  recentTasks: { id: string; name: string; completedAt: Date; subject: string; bookImageUrl?: string | null }[];
  attendanceRecords: AttendanceRecord[];
  avgTestScore: number | null;
  recentTestResults: { id: string; name: string; score: number; completedAt: Date }[];
};

const formatSecondsToHoursMinutes = (seconds: number): string => {
  if (!seconds || seconds < 0) return '0分';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}時間${minutes}分` : `${minutes}分`;
};

const subjectColors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6'];

export default function AnalyticsPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('7');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [studentName, setStudentName] = useState<string>('');
  const [tooltip, setTooltip] = useState<{ visible: boolean; content: string; x: number; y: number } | null>(null);

  const fetchData = useCallback(async (days: number) => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
      const startDateStr = startDate.toISOString();

      // Fetch master data in parallel
      const [subjectsRes, tasksRes, userRes, booksRes, classesRes] = await Promise.all([
        supabase.from('subjects').select('id, name'),
        supabase.from('tasks').select('id, name, book_id'),
        supabase.from('users').select('nickname').eq('id', currentUser.id).single<{ nickname: string | null }>(),
        supabase.from('books').select('id, name, image_url, subject_id'),
        supabase.from('classes').select('id, title'),
      ]);

      const subMap = new Map<string, string>();
      subjectsRes.data?.forEach((s: any) => subMap.set(s.id, s.name));

      const tMap = new Map<string, string>();
      tasksRes.data?.forEach((t: any) => tMap.set(t.id, t.name));

      const taskBookMap = new Map<string, string>();
      tasksRes.data?.forEach((t: any) => taskBookMap.set(t.id, t.book_id));

      setStudentName(userRes.data?.nickname || '生徒');

      const bMap = new Map<string, any>();
      booksRes.data?.forEach((b: any) => bMap.set(b.id, b));

      const classesMap = new Map<string, string>();
      classesRes.data?.forEach((c: any) => classesMap.set(c.id, c.title));

      // Fetch transactional data in parallel
      const [timeLogsRes, curriculumRes, attendanceRes] = await Promise.all([
        supabase
          .from('time_logs')
          .select('id, curriculum_id, duration_seconds, created_at')
          .eq('user_id', currentUser.id)
          .gte('created_at', startDateStr),
        supabase
          .from('user_curriculum')
          .select('id, task_id, book_id, subject_id, status, updated_at')
          .eq('user_id', currentUser.id)
          .eq('status', 'completed')
          .gte('updated_at', startDateStr)
          .order('updated_at', { ascending: false }),
        supabase
          .from('attendance_records')
          .select('id, class_id, created_at')
          .eq('user_id', currentUser.id)
          .gte('created_at', startDateStr)
          .order('created_at', { ascending: false }),
      ]);

      const timeLogs = (timeLogsRes.data || []) as any[];
      const curriculumItems = (curriculumRes.data || []) as any[];
      const attendanceItems = (attendanceRes.data || []) as any[];

      // Build curriculum map for time log lookups
      const curriculumMap = new Map<string, any>();
      curriculumItems.forEach((c: any) => curriculumMap.set(c.id, c));

      let totalTime = 0;
      const dailyTimeMap = new Map<string, number>();
      const subjectTimeMap = new Map<string, number>();

      // Initialize daily map
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyTimeMap.set(d.toISOString().split('T')[0], 0);
      }

      timeLogs.forEach((log: any) => {
        totalTime += log.duration_seconds;
        const dateStr = new Date(log.created_at).toISOString().split('T')[0];
        dailyTimeMap.set(dateStr, (dailyTimeMap.get(dateStr) || 0) + log.duration_seconds);

        const curriculumItem = curriculumMap.get(log.curriculum_id);
        if (curriculumItem) {
          const subjectName = subMap.get(curriculumItem.subject_id) || 'その他';
          subjectTimeMap.set(subjectName, (subjectTimeMap.get(subjectName) || 0) + log.duration_seconds);
        }
      });

      const dailyData = Array.from(dailyTimeMap.entries())
        .map(([date, time]) => ({
          dateForSort: new Date(date),
          fullDate: new Date(date),
          day: new Date(date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
          time,
        }))
        .sort((a, b) => a.dateForSort.getTime() - b.dateForSort.getTime())
        .map(({ day, time, fullDate }) => ({ day, time, fullDate }));

      const subjectData = Array.from(subjectTimeMap.entries())
        .map(([subject, time]) => ({ subject, time }))
        .sort((a, b) => b.time - a.time);

      const recentTasks = curriculumItems.slice(0, 10).map((c: any) => {
        const bookData = bMap.get(c.book_id);
        return {
          id: c.id,
          name: tMap.get(c.task_id) || '無題のタスク',
          completedAt: new Date(c.updated_at),
          subject: subMap.get(c.subject_id) || 'その他',
          bookImageUrl: bookData?.image_url || null,
        };
      });

      const attendanceRecords = attendanceItems.map((a: any) => ({
        id: a.id,
        className: classesMap.get(a.class_id) || '不明な特訓',
        attendedAt: new Date(a.created_at),
      }));

      // Fetch test scores from progress table
      const { data: progressData } = await supabase
        .from('progress')
        .select('id, task_id, score, updated_at')
        .eq('user_id', currentUser.id)
        .not('score', 'is', null)
        .gte('updated_at', startDateStr)
        .order('updated_at', { ascending: false });

      let totalScore = 0;
      let testCount = 0;
      const recentTestResults: { id: string; name: string; score: number; completedAt: Date }[] = [];

      (progressData || []).forEach((p: any) => {
        if (p.score !== null && p.score !== undefined) {
          totalScore += p.score;
          testCount++;
          if (recentTestResults.length < 5) {
            recentTestResults.push({
              id: p.id,
              name: tMap.get(p.task_id) || '不明なタスク',
              score: p.score,
              completedAt: new Date(p.updated_at),
            });
          }
        }
      });
      const avgTestScore = testCount > 0 ? Math.round(totalScore / testCount) : null;

      setAnalyticsData({
        totalTime,
        totalTasks: curriculumItems.length,
        avgTimePerDay: totalTime / days,
        dailyData,
        subjectData,
        recentTasks,
        attendanceRecords,
        avgTestScore,
        recentTestResults,
      });
    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [currentUser, supabase]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.push('/login');
      return;
    }
    fetchData(parseInt(timeRange, 10));
  }, [authLoading, currentUser, router, timeRange, fetchData]);

  const { yAxisMax, yAxisLabels } = useMemo(() => {
    if (!analyticsData) return { yAxisMax: 3600, yAxisLabels: [] as { value: number; text: string; position: number }[] };

    const maxTime = Math.max(...analyticsData.dailyData.map(d => d.time), 1);
    const yAxisTopValue = Math.max(Math.ceil(maxTime / 3600) * 3600, 3600);

    const numberOfTicks = 4;
    const tickInterval = yAxisTopValue / numberOfTicks;

    const labels = [];
    for (let i = 0; i <= numberOfTicks; i++) {
      const timeValue = i * tickInterval;
      labels.push({
        value: timeValue,
        text: `${timeValue / 3600}h`,
        position: (timeValue / yAxisTopValue) * 100,
      });
    }
    return { yAxisMax: yAxisTopValue, yAxisLabels: labels };
  }, [analyticsData]);

  const renderConicGradient = (data: { subject: string; time: number }[]) => {
    const total = data.reduce((sum, item) => sum + item.time, 0);
    if (total === 0) return 'radial-gradient(#F3F4F6, #E5E7EB)';
    let angle = 0;
    const gradientParts = data.map((item, index) => {
      const percentage = (item.time / total) * 100;
      const part = `${subjectColors[index % subjectColors.length]} ${angle}deg ${angle + percentage * 3.6}deg`;
      angle += percentage * 3.6;
      return part;
    });
    return `conic-gradient(${gradientParts.join(', ')})`;
  };

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-4xl text-center p-8 animate-fade-in mt-8">
        <div className="spinner mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl card p-8 animate-fade-in mt-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 border-b dark:border-primary-800 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-700 dark:text-warm-100 tracking-wider">学習アナリティクス</h1>
          <p className="text-warm-500 dark:text-warm-400 mt-1">{studentName}さんの学習記録</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button onClick={() => setTimeRange('7')} className={`px-4 py-2 text-sm font-medium rounded-btn ${timeRange === '7' ? 'bg-primary-600 text-white' : 'bg-warm-200 dark:bg-primary-800'}`}>過去7日間</button>
          <button onClick={() => setTimeRange('30')} className={`px-4 py-2 text-sm font-medium rounded-btn ${timeRange === '30' ? 'bg-primary-600 text-white' : 'bg-warm-200 dark:bg-primary-800'}`}>過去30日間</button>
          <Link href="/mypage" className="text-sm text-primary-600 dark:text-primary-400 hover:underline ml-4">&larr; 戻る</Link>
        </div>
      </div>

      {error ? (
        <div className="text-center p-8 bg-danger-100 dark:bg-danger-900/50 rounded-btn"><p className="text-danger-600 dark:text-danger-300">{error}</p></div>
      ) : analyticsData && (
        <div className="space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            <div className="bg-primary-100 dark:bg-primary-900/40 p-6 rounded-btn"><h3 className="text-lg font-semibold text-primary-800 dark:text-primary-200">総学習時間</h3><p className="text-3xl font-bold text-primary-600 dark:text-primary-400 mt-2">{formatSecondsToHoursMinutes(analyticsData.totalTime)}</p></div>
            <div className="bg-info-100 dark:bg-info-900/40 p-6 rounded-btn"><h3 className="text-lg font-semibold text-info-800 dark:text-info-200">完了タスク数</h3><p className="text-3xl font-bold text-info-600 dark:text-info-400 mt-2">{analyticsData.totalTasks}</p></div>
            <div className="bg-warning-100 dark:bg-warning-900/40 p-6 rounded-btn"><h3 className="text-lg font-semibold text-warning-800 dark:text-warning-200">平均学習時間/日</h3><p className="text-3xl font-bold text-warning-600 dark:text-warning-400 mt-2">{formatSecondsToHoursMinutes(analyticsData.avgTimePerDay)}</p></div>
            <div className="bg-danger-100 dark:bg-danger-900/40 p-6 rounded-btn"><h3 className="text-lg font-semibold text-danger-800 dark:text-danger-200">平均テスト点数</h3><p className="text-3xl font-bold text-danger-600 dark:text-danger-400 mt-2">{analyticsData.avgTestScore !== null ? `${analyticsData.avgTestScore}点` : '-'}</p></div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3 bg-warm-50 dark:bg-primary-800/50 p-6 rounded-btn relative">
              {tooltip && tooltip.visible && (
                <div
                  className="absolute bg-primary-950 text-white text-xs rounded py-1 px-2 pointer-events-none z-10 transform -translate-y-full -translate-x-1/2"
                  style={{ top: tooltip.y, left: tooltip.x }}
                >
                  {tooltip.content}
                </div>
              )}
              <h3 className="text-xl font-bold text-primary-800 dark:text-warm-100 mb-4">日別学習時間</h3>
              <div className="flex h-48">
                {/* Y-axis labels */}
                <div className="relative w-12 h-full text-xs text-right pr-2 text-warm-400 dark:text-warm-500">
                  {yAxisLabels.map(label => (
                    <div key={label.value} className="absolute transform -translate-y-1/2" style={{ bottom: `${label.position}%` }}>
                      {label.text}
                    </div>
                  ))}
                </div>
                {/* Chart bars */}
                <div className="flex-1 flex justify-around items-end gap-1 border-l border-b border-warm-200 dark:border-primary-700">
                  {analyticsData.dailyData.map((data, index) => {
                    const barHeight = `${(data.time / yAxisMax) * 100}%`;
                    const showLabel = timeRange === '7' || (timeRange === '30' && (index % 7 === 0 || index === analyticsData.dailyData.length - 1));

                    return (
                      <div
                        key={index}
                        className="flex flex-col items-center flex-1 h-full"
                        onMouseEnter={(e) => {
                          const container = e.currentTarget.closest('.relative');
                          const barElement = e.currentTarget.querySelector('.chart-bar-element');
                          if (!container || !barElement) return;

                          const containerRect = container.getBoundingClientRect();
                          const barRect = barElement.getBoundingClientRect();
                          const parentRect = e.currentTarget.getBoundingClientRect();

                          const x = parentRect.left - containerRect.left + parentRect.width / 2;
                          const y = barRect.top - containerRect.top - 5;

                          const dateString = data.fullDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
                          setTooltip({
                            visible: true,
                            content: `${dateString}: ${formatSecondsToHoursMinutes(data.time)}`,
                            x: x,
                            y: y,
                          });
                        }}
                        onMouseLeave={() => setTooltip(prev => prev ? { ...prev, visible: false } : null)}
                      >
                        <div className="w-full flex-grow flex items-end justify-center">
                          <div className="chart-bar-element w-3/4 bg-primary-500 rounded-t-sm hover:bg-primary-400 transition-colors" style={{ height: barHeight }}></div>
                        </div>
                        <span className={`text-[10px] text-warm-500 dark:text-warm-400 mt-1 ${showLabel ? 'visible' : 'invisible'}`}>
                          {data.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 bg-warm-50 dark:bg-primary-800/50 p-6 rounded-btn">
              <h3 className="text-xl font-bold text-primary-800 dark:text-warm-100 mb-4">科目別学習割合</h3>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <div className="w-32 h-32 rounded-full" style={{ background: renderConicGradient(analyticsData.subjectData) }}></div>
                <ul className="space-y-2 text-sm">
                  {analyticsData.subjectData.length > 0 ? analyticsData.subjectData.map((item, index) => (
                    <li key={index} className="flex items-center"><div className="w-3 h-3 rounded-sm mr-2" style={{ backgroundColor: subjectColors[index % subjectColors.length] }}></div><span className="font-medium text-primary-700 dark:text-warm-300">{item.subject}: {formatSecondsToHoursMinutes(item.time)}</span></li>
                  )) : <p className="text-warm-500 dark:text-warm-400">データがありません</p>}
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Recent Activity */}
            <div>
              <h3 className="text-xl font-bold text-primary-800 dark:text-warm-100 mb-4">最近完了したタスク</h3>
              <div className="bg-warm-50 dark:bg-primary-800/50 p-4 rounded-btn">
                <ul className="divide-y divide-warm-200 dark:divide-primary-700">
                  {analyticsData.recentTasks.length > 0 ? analyticsData.recentTasks.map(task => (
                    <li key={task.id} className="py-3 flex items-center gap-4">
                      {task.bookImageUrl ? (
                        <img src={task.bookImageUrl} alt="" className="w-10 h-14 object-contain rounded-input flex-shrink-0 bg-warm-200" />
                      ) : (
                        <div className="w-10 h-14 bg-warm-200 dark:bg-primary-700 rounded-input flex-shrink-0"></div>
                      )}
                      <div className="flex-grow">
                        <p className="font-medium text-primary-800 dark:text-warm-200">{task.name}</p>
                        <p className="text-sm text-warm-500 dark:text-warm-400">{task.subject}</p>
                      </div>
                      <p className="text-sm text-warm-500 dark:text-warm-400 flex-shrink-0">{task.completedAt.toLocaleDateString('ja-JP')}</p>
                    </li>
                  )) : <p className="text-center text-warm-500 dark:text-warm-400 py-4">この期間に完了したタスクはありません。</p>}
                </ul>
              </div>
            </div>

            {/* Recent Test Results */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-primary-800 dark:text-warm-100">最近のテスト結果</h3>
              </div>
              <div className="bg-warm-50 dark:bg-primary-800/50 p-4 rounded-btn">
                <ul className="divide-y divide-warm-200 dark:divide-primary-700">
                  {analyticsData.recentTestResults.length > 0 ? analyticsData.recentTestResults.map(test => (
                    <li key={test.id} className="py-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-primary-800 dark:text-warm-200">{test.name}</p>
                        <p className="text-xs text-warm-500 dark:text-warm-400">{test.completedAt.toLocaleDateString('ja-JP')}</p>
                      </div>
                      <div className="flex items-center">
                        <span className={`text-lg font-bold ${test.score >= 80 ? 'text-success-600 dark:text-success-400' : 'text-warning-600 dark:text-warning-400'}`}>
                          {test.score}
                        </span>
                        <span className="text-xs text-warm-500 dark:text-warm-400 ml-1">点</span>
                      </div>
                    </li>
                  )) : <p className="text-center text-warm-500 dark:text-warm-400 py-4">この期間のテスト結果はありません。</p>}
                </ul>
              </div>
            </div>
          </div>

          {/* Attendance Record */}
          <div>
            <h3 className="text-xl font-bold text-primary-800 dark:text-warm-100 mb-4">出席記録</h3>
            <div className="bg-warm-50 dark:bg-primary-800/50 p-4 rounded-btn">
              <ul className="divide-y divide-warm-200 dark:divide-primary-700">
                {analyticsData.attendanceRecords.length > 0 ? analyticsData.attendanceRecords.map(record => (
                  <li key={record.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-primary-800 dark:text-warm-200">{record.className}</p>
                    </div>
                    <p className="text-sm text-warm-500 dark:text-warm-400">{record.attendedAt.toLocaleDateString('ja-JP')}</p>
                  </li>
                )) : <p className="text-center text-warm-500 dark:text-warm-400 py-4">この期間の出席記録はありません。</p>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
