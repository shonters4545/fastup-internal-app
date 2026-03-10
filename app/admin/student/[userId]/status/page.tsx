'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

const formatSeconds = (seconds: number): string => {
  if (seconds < 0) seconds = 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}時間${minutes}分`;
};

type TimeLog = {
  id: string;
  duration_seconds: number;
  subject_name: string | null;
  created_at: string;
};

type ProgressSummary = {
  subject_name: string;
  total_tasks: number;
  completed_tasks: number;
};

export default function AdminStudentStatusPage() {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(true);

  // Stats
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [weekSeconds, setWeekSeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [targetTime, setTargetTime] = useState(0);
  const [recentLogs, setRecentLogs] = useState<TimeLog[]>([]);
  const [progressSummary, setProgressSummary] = useState<ProgressSummary[]>([]);

  useEffect(() => {
    if (authLoading || !currentUser || !userId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch student info
        const { data: user } = await (supabase.from('users') as any)
          .select('nickname, target_time')
          .eq('id', userId)
          .single();
        setStudentName(user?.nickname || '名前未設定');
        setTargetTime((user?.target_time || 0) * 3600);

        // Fetch time logs
        const { data: timeLogs } = await (supabase.from('time_logs') as any)
          .select('id, duration_seconds, subject_name, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        const logs = (timeLogs || []) as TimeLog[];
        setRecentLogs(logs.slice(0, 20));

        // Calculate stats
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());

        let todayTotal = 0;
        let weekTotal = 0;
        let allTotal = 0;

        logs.forEach(log => {
          const logDate = new Date(log.created_at);
          const seconds = log.duration_seconds || 0;
          allTotal += seconds;
          if (logDate >= todayStart) todayTotal += seconds;
          if (logDate >= weekStart) weekTotal += seconds;
        });

        setTodaySeconds(todayTotal);
        setWeekSeconds(weekTotal);
        setTotalSeconds(allTotal);

        // Fetch progress summary per subject
        const { data: userSubs } = await (supabase.from('user_subjects') as any)
          .select('subject_id, subjects(name)')
          .eq('user_id', userId);

        if (userSubs) {
          const summaries: ProgressSummary[] = [];
          for (const us of userSubs as any[]) {
            const subjectName = us.subjects?.name || '不明';
            const subjectId = us.subject_id;

            // Count total tasks in user's curriculum for this subject
            const { count: totalCount } = await (supabase.from('progress') as any)
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId);

            // Get progress for books in this subject's divisions
            const { data: divisions } = await (supabase.from('divisions') as any)
              .select('id')
              .eq('subject_id', subjectId);
            const divIds = ((divisions || []) as any[]).map(d => d.id);

            if (divIds.length > 0) {
              const { data: books } = await (supabase.from('books') as any)
                .select('id')
                .in('division_id', divIds);
              const bookIds = ((books || []) as any[]).map(b => b.id);

              if (bookIds.length > 0) {
                const { data: tasks } = await (supabase.from('tasks') as any)
                  .select('id')
                  .in('book_id', bookIds);
                const taskIds = ((tasks || []) as any[]).map(t => t.id);
                const totalTasks = taskIds.length;

                if (totalTasks > 0) {
                  const { count: completedCount } = await (supabase.from('progress') as any)
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .eq('status', 'completed')
                    .in('task_id', taskIds);

                  summaries.push({
                    subject_name: subjectName,
                    total_tasks: totalTasks,
                    completed_tasks: completedCount || 0,
                  });
                }
              }
            }
          }
          setProgressSummary(summaries);
        }
      } catch (err) {
        console.error('Error fetching status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, currentUser, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin" />
      </div>
    );
  }

  if (!authLoading && currentUser && !['admin', 'super'].includes(currentUser.role)) {
    router.push('/');
    return null;
  }

  const dailyProgressPct = targetTime > 0 ? Math.min((todaySeconds / targetTime) * 100, 100) : 0;
  const isGoalMet = targetTime > 0 && todaySeconds >= targetTime;

  return (
    <div className="w-full max-w-4xl animate-fade-in mt-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4 gap-2">
        <Link href="/admin/students" className="hover:text-blue-600 dark:hover:text-blue-400">生徒一覧</Link>
        <span>/</span>
        <Link href={`/admin/student/${userId}`} className="hover:text-blue-600 dark:hover:text-blue-400">{studentName}</Link>
        <span>/</span>
        <span className="text-gray-800 dark:text-white font-medium">学習ステータス</span>
      </nav>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">学習ステータス</h1>

        {/* Study Time Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">今日の学習時間</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{formatSeconds(todaySeconds)}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg text-center">
            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">今週の学習時間</p>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">{formatSeconds(weekSeconds)}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">累計学習時間</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">{formatSeconds(totalSeconds)}</p>
          </div>
        </div>

        {/* Daily Goal */}
        {targetTime > 0 && (
          <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">本日の目標達成率</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{formatSeconds(todaySeconds)} / {formatSeconds(targetTime)}</span>
            </div>
            <div className="w-full h-4 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${isGoalMet ? 'bg-teal-500' : 'bg-blue-500'}`} style={{ width: `${dailyProgressPct}%` }} />
            </div>
            {isGoalMet && <p className="text-center mt-2 text-sm font-semibold text-teal-600 dark:text-teal-400">目標達成!</p>}
          </div>
        )}

        {/* Curriculum Progress */}
        {progressSummary.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">カリキュラム進捗</h2>
            <div className="space-y-3">
              {progressSummary.map((ps, i) => {
                const pct = ps.total_tasks > 0 ? Math.round((ps.completed_tasks / ps.total_tasks) * 100) : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{ps.subject_name}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{ps.completed_tasks}/{ps.total_tasks} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all duration-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">最近の学習記録</h2>
          {recentLogs.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">学習記録がありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">日時</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">科目</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">時間</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {recentLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{new Date(log.created_at).toLocaleString('ja-JP')}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{log.subject_name || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{formatSeconds(log.duration_seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
