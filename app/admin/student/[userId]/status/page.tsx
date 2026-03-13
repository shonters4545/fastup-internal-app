'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

type SubjectProgress = {
  subject_id: string;
  subject_name: string;
  total_tasks: number;
  completed_tasks: number;
  current_lap: number;
};

type TestScore = {
  id: string;
  task_name: string;
  subject_name: string;
  score: number;
  lap: number;
  updated_at: string;
};

type AttendanceDay = {
  date: string;
  planned: boolean;
  attended: boolean;
  study_material?: string;
};

export default function AdminStudentStatusPage() {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(true);

  // Section 1: Summary cards
  const [totalTasks, setTotalTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null);
  const [attendedCount, setAttendedCount] = useState(0);
  const [plannedCount, setPlannedCount] = useState(0);

  // Section 2: Subject progress
  const [subjectProgress, setSubjectProgress] = useState<SubjectProgress[]>([]);

  // Section 3: Test scores
  const [testScores, setTestScores] = useState<TestScore[]>([]);
  const [subjectAvgScores, setSubjectAvgScores] = useState<{ subject_name: string; avg: number }[]>([]);

  // Section 4: Attendance
  const [attendanceDays, setAttendanceDays] = useState<AttendanceDay[]>([]);
  const [consecutiveAbsences, setConsecutiveAbsences] = useState(0);

  useEffect(() => {
    if (authLoading || !currentUser || !userId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // === Fetch student name ===
        const { data: user } = await (supabase.from('users') as any)
          .select('nickname')
          .eq('id', userId)
          .single();
        setStudentName(user?.nickname || '名前未設定');

        // === Fetch all data in parallel ===
        const [
          curriculumResult,
          progressResult,
          userSubjectsResult,
          plansResult,
          recordsResult,
        ] = await Promise.all([
          // User curriculum items
          (supabase.from('user_curriculum') as any)
            .select('task_id, book_id, subject_id, status')
            .eq('user_id', userId),
          // Progress with scores and laps
          (supabase.from('progress') as any)
            .select('task_id, status, score, lap, updated_at, book_id')
            .eq('user_id', userId),
          // User subjects
          (supabase.from('user_subjects') as any)
            .select('subject_id, subjects(name)')
            .eq('user_id', userId),
          // Attendance plans (last 30 days)
          (supabase.from('attendance_plans') as any)
            .select('date, planned')
            .eq('user_id', userId)
            .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .lte('date', new Date().toISOString().split('T')[0]),
          // Attendance records (last 30 days) with class info
          (supabase.from('attendance_records') as any)
            .select('class_id, status, attended_at, study_material, classes(start_time)')
            .eq('user_id', userId)
            .order('attended_at', { ascending: false }),
        ]);

        const curriculum = (curriculumResult.data || []) as any[];
        const progress = (progressResult.data || []) as any[];
        const userSubjects = (userSubjectsResult.data || []) as any[];
        const plans = (plansResult.data || []) as any[];
        const records = (recordsResult.data || []) as any[];

        // === Section 1: Summary Cards ===

        // Curriculum progress rate
        const totalT = curriculum.length;
        const completedT = curriculum.filter((c: any) => c.status === 'completed').length;
        setTotalTasks(totalT);
        setCompletedTasks(completedT);

        // Average test score (from progress where score IS NOT NULL)
        const scoredProgress = progress.filter((p: any) => p.score != null);
        if (scoredProgress.length > 0) {
          const avg = scoredProgress.reduce((sum: number, p: any) => sum + p.score, 0) / scoredProgress.length;
          setAvgScore(Math.round(avg * 10) / 10);
        } else {
          setAvgScore(null);
        }

        // Attendance rate (last 30 days)
        const plannedDates = plans.filter((p: any) => p.planned);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentRecords = records.filter((r: any) => {
          const date = r.attended_at ? new Date(r.attended_at) : (r.classes?.start_time ? new Date(r.classes.start_time) : null);
          return date && date >= thirtyDaysAgo;
        });
        const attendedDates = new Set(
          recentRecords.map((r: any) => {
            const date = r.attended_at ? new Date(r.attended_at) : new Date(r.classes?.start_time);
            return date.toISOString().split('T')[0];
          })
        );

        const pCount = plannedDates.length;
        const aCount = attendedDates.size;
        setPlannedCount(pCount);
        setAttendedCount(aCount);
        if (pCount > 0) {
          setAttendanceRate(Math.round((aCount / pCount) * 100));
        } else {
          setAttendanceRate(null);
        }

        // === Section 2: Subject Progress ===
        // Build subject→tasks mapping via divisions→books→tasks
        const subjectMap = new Map<string, string>();
        userSubjects.forEach((us: any) => {
          subjectMap.set(us.subject_id, us.subjects?.name || '不明');
        });

        // Group curriculum by subject
        const subjectGroups = new Map<string, { total: number; completed: number; maxLap: number }>();
        curriculum.forEach((c: any) => {
          const sid = c.subject_id;
          if (!sid) return;
          const group = subjectGroups.get(sid) || { total: 0, completed: 0, maxLap: 1 };
          group.total++;
          if (c.status === 'completed') group.completed++;
          subjectGroups.set(sid, group);
        });

        // Get max lap per subject from progress
        progress.forEach((p: any) => {
          const currItem = curriculum.find((c: any) => c.task_id === p.task_id);
          if (currItem?.subject_id) {
            const group = subjectGroups.get(currItem.subject_id);
            if (group && p.lap > group.maxLap) {
              group.maxLap = p.lap;
            }
          }
        });

        const spArr: SubjectProgress[] = [];
        subjectGroups.forEach((val, sid) => {
          spArr.push({
            subject_id: sid,
            subject_name: subjectMap.get(sid) || '不明',
            total_tasks: val.total,
            completed_tasks: val.completed,
            current_lap: val.maxLap,
          });
        });
        setSubjectProgress(spArr);

        // === Section 3: Test Scores ===
        // Fetch task names for scored progress
        const scoredTaskIds = scoredProgress.map((p: any) => p.task_id).filter(Boolean);
        let taskNameMap = new Map<string, { name: string; book_id: string }>();
        if (scoredTaskIds.length > 0) {
          const { data: tasks } = await (supabase.from('tasks') as any)
            .select('id, name, book_id')
            .in('id', scoredTaskIds);
          (tasks || []).forEach((t: any) => {
            taskNameMap.set(t.id, { name: t.name, book_id: t.book_id });
          });
        }

        // Map task→subject via curriculum
        const taskSubjectMap = new Map<string, string>();
        curriculum.forEach((c: any) => {
          if (c.task_id && c.subject_id) {
            taskSubjectMap.set(c.task_id, subjectMap.get(c.subject_id) || '不明');
          }
        });

        const scores: TestScore[] = scoredProgress
          .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 10)
          .map((p: any) => ({
            id: p.task_id,
            task_name: taskNameMap.get(p.task_id)?.name || 'タスク',
            subject_name: taskSubjectMap.get(p.task_id) || '不明',
            score: p.score,
            lap: p.lap || 1,
            updated_at: p.updated_at,
          }));
        setTestScores(scores);

        // Subject average scores
        const subjectScoreMap = new Map<string, number[]>();
        scoredProgress.forEach((p: any) => {
          const sname = taskSubjectMap.get(p.task_id);
          if (sname) {
            const arr = subjectScoreMap.get(sname) || [];
            arr.push(p.score);
            subjectScoreMap.set(sname, arr);
          }
        });
        const subAvgs: { subject_name: string; avg: number }[] = [];
        subjectScoreMap.forEach((scores, name) => {
          subAvgs.push({
            subject_name: name,
            avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
          });
        });
        setSubjectAvgScores(subAvgs);

        // === Section 4: Attendance (last 7 days) ===
        const today = new Date();
        const days: AttendanceDay[] = [];
        const planDateSet = new Set(plans.filter((p: any) => p.planned).map((p: any) => p.date));

        // Build attended date map with study material
        const attendedMap = new Map<string, string | undefined>();
        recentRecords.forEach((r: any) => {
          const date = r.attended_at ? new Date(r.attended_at) : (r.classes?.start_time ? new Date(r.classes.start_time) : null);
          if (date) {
            const dateStr = date.toISOString().split('T')[0];
            if (!attendedMap.has(dateStr)) {
              attendedMap.set(dateStr, r.study_material || undefined);
            }
          }
        });

        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          days.push({
            date: dateStr,
            planned: planDateSet.has(dateStr),
            attended: attendedMap.has(dateStr),
            study_material: attendedMap.get(dateStr),
          });
        }
        setAttendanceDays(days);

        // Consecutive absences (count from today backwards where planned but not attended)
        let consecutive = 0;
        for (let i = 0; i < 30; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          if (planDateSet.has(dateStr) && !attendedMap.has(dateStr)) {
            consecutive++;
          } else if (planDateSet.has(dateStr) && attendedMap.has(dateStr)) {
            break;
          }
          // Skip non-planned days
        }
        setConsecutiveAbsences(consecutive);

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

  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const getDayOfWeek = (dateStr: string) => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[new Date(dateStr).getDay()];
  };

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

        {/* === Section 1: Summary Cards === */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Curriculum Progress */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">カリキュラム進捗率</p>
            <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{progressPct}%</p>
            <div className="w-full h-2 bg-blue-200 dark:bg-blue-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">{completedTasks} / {totalTasks} タスク完了</p>
          </div>

          {/* Average Test Score */}
          <div className="bg-purple-50 dark:bg-purple-900/20 p-5 rounded-xl">
            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">平均テストスコア</p>
            {avgScore !== null ? (
              <>
                <p className={`text-3xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}<span className="text-lg">点</span></p>
                <p className="text-xs text-purple-500 dark:text-purple-400 mt-2">{testScores.length > 0 ? `直近${testScores.length}件のテスト` : ''}</p>
              </>
            ) : (
              <p className="text-lg text-gray-400 dark:text-gray-500 mt-2">データなし</p>
            )}
          </div>

          {/* Attendance Rate */}
          <div className="bg-green-50 dark:bg-green-900/20 p-5 rounded-xl">
            <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">出席率（直近30日）</p>
            {attendanceRate !== null ? (
              <>
                <p className="text-3xl font-bold text-green-700 dark:text-green-300">{attendanceRate}%</p>
                <p className="text-xs text-green-500 dark:text-green-400 mt-2">{attendedCount} / {plannedCount} 回出席</p>
              </>
            ) : (
              <p className="text-lg text-gray-400 dark:text-gray-500 mt-2">予定なし</p>
            )}
          </div>
        </div>

        {/* === Section 2: Subject Progress === */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">科目別カリキュラム進捗</h2>
          {subjectProgress.length > 0 ? (
            <div className="space-y-3">
              {subjectProgress.map((sp) => {
                const pct = sp.total_tasks > 0 ? Math.round((sp.completed_tasks / sp.total_tasks) * 100) : 0;
                return (
                  <Link
                    key={sp.subject_id}
                    href={`/admin/student/${userId}/curriculum`}
                    className="block p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{sp.subject_name}</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300">
                          {sp.current_lap}周目
                        </span>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {sp.completed_tasks}/{sp.total_tasks} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all duration-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">カリキュラムが設定されていません。</p>
          )}
        </div>

        {/* === Section 3: Test Scores === */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">テストスコア推移</h2>

          {/* Subject average badges */}
          {subjectAvgScores.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {subjectAvgScores.map((sa) => (
                <span
                  key={sa.subject_name}
                  className={`text-xs px-3 py-1 rounded-full font-medium ${getScoreBg(sa.avg)} ${getScoreColor(sa.avg)}`}
                >
                  {sa.subject_name}: 平均 {sa.avg}点
                </span>
              ))}
            </div>
          )}

          {testScores.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">タスク名</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">科目</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">スコア</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">周回</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">日付</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {testScores.map((ts, i) => (
                    <tr key={`${ts.id}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{ts.task_name}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{ts.subject_name}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-sm font-bold ${getScoreColor(ts.score)}`}>{ts.score}点</span>
                      </td>
                      <td className="px-4 py-2 text-center text-sm text-gray-500 dark:text-gray-400">{ts.lap}周目</td>
                      <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(ts.updated_at).toLocaleDateString('ja-JP')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">テストスコアのデータがありません。</p>
          )}
        </div>

        {/* === Section 4: Attendance === */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">出席状況</h2>

          {/* Consecutive absence alert */}
          {consecutiveAbsences >= 3 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
              <p className="text-red-700 dark:text-red-400 text-sm font-medium">
                {consecutiveAbsences}日連続で欠席しています
              </p>
            </div>
          )}

          {/* 7-day attendance calendar */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {attendanceDays.map((day) => (
              <div key={day.date} className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {formatDate(day.date)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  ({getDayOfWeek(day.date)})
                </p>
                <div className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center text-lg ${
                  day.planned && day.attended
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : day.planned && !day.attended
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : day.attended
                    ? 'bg-gray-100 dark:bg-gray-700'
                    : 'bg-gray-50 dark:bg-gray-800'
                }`}>
                  {day.planned && day.attended && <span className="text-green-600">&#x2713;</span>}
                  {day.planned && !day.attended && <span className="text-red-500">&#x2717;</span>}
                  {!day.planned && day.attended && <span className="text-gray-400">&#x2713;</span>}
                  {!day.planned && !day.attended && <span className="text-gray-300 dark:text-gray-600">-</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Recent study materials */}
          {attendanceDays.some(d => d.study_material) && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">直近の取り組み教材</p>
              <div className="space-y-1">
                {attendanceDays
                  .filter(d => d.study_material)
                  .map(d => (
                    <div key={d.date} className="flex gap-2 text-sm">
                      <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(d.date)}</span>
                      <span className="text-gray-700 dark:text-gray-300">{d.study_material}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
