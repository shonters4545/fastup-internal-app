'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import TestScoreModal from '@/components/TestScoreModal';

const formatTime = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0'),
  ].join(':');
};

interface TaskInfo {
  name: string;
  taskId: string;
  subjectName: string;
  divisionName: string;
  bookImageUrl: string | null;
  bookId: string;
  isCustom: boolean;
}

export default function TimerPage() {
  const { curriculumId } = useParams<{ curriculumId: string }>();
  const router = useRouter();
  const { currentUser, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [taskInfo, setTaskInfo] = useState<TaskInfo | null>(null);
  const [totalElapsedSeconds, setTotalElapsedSeconds] = useState(0);
  const [currentSessionSeconds, setCurrentSessionSeconds] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);

  const sessionStartTime = useRef<Date | null>(null);
  const userId = currentUser?.id;

  // Fetch task info from user_curriculum
  useEffect(() => {
    if (authLoading || !userId || !curriculumId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch the curriculum entry
        const { data: curriculum, error: currError } = await supabase
          .from('user_curriculum')
          .select('*, tasks(name, book_id), books(name, image_url, is_custom, division_id, subject_id)')
          .eq('id', curriculumId)
          .single<any>();

        if (currError || !curriculum) throw new Error('指定されたタスクが見つかりません。');

        // Fetch subject and division names
        const [subjectRes, divisionRes] = await Promise.all([
          supabase.from('subjects').select('name').eq('id', curriculum.subject_id).single<{ name: string }>(),
          supabase.from('divisions').select('name').eq('id', curriculum.books?.division_id || '').single<{ name: string }>(),
        ]);

        setTaskInfo({
          name: curriculum.tasks?.name || curriculum.notes || '無題のタスク',
          taskId: curriculum.task_id,
          subjectName: subjectRes.data?.name || '不明な科目',
          divisionName: divisionRes.data?.name || '不明な単元',
          bookImageUrl: curriculum.books?.image_url || null,
          bookId: curriculum.book_id,
          isCustom: curriculum.books?.is_custom || false,
        });

        // Fetch previous time logs
        const { data: timeLogs } = await (supabase.from('time_logs') as any)
          .select('duration_seconds')
          .eq('user_id', userId)
          .eq('curriculum_id', curriculumId);

        const totalSeconds = ((timeLogs || []) as any[]).reduce((acc: number, log: any) => acc + (log.duration_seconds || 0), 0);
        setTotalElapsedSeconds(totalSeconds);

        sessionStartTime.current = new Date();
      } catch (err) {
        console.error('Failed to fetch timer data:', err);
        setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました。');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [authLoading, userId, curriculumId]);

  // Timer interval
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isActive && !isLoading) {
      interval = setInterval(() => {
        setCurrentSessionSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isActive, isLoading]);

  const handleStopTimer = (status: 'paused' | 'completed') => {
    if (!curriculumId || !sessionStartTime.current || isSubmitting) return;
    if (status === 'completed' && taskInfo && !taskInfo.isCustom) {
      setIsActive(false);
      setIsScoreModalOpen(true);
    } else {
      submitTimeLog(status, null, false);
    }
  };

  const submitTimeLog = async (status: 'paused' | 'completed', score: number | null, isSkipped: boolean) => {
    if (!curriculumId || !sessionStartTime.current || !userId) return;
    setIsSubmitting(true);

    try {
      const endTime = new Date();
      const durationSeconds = Math.round((endTime.getTime() - sessionStartTime.current.getTime()) / 1000);

      // 1. Add time log
      await (supabase.from('time_logs') as any).insert({
        user_id: userId,
        curriculum_id: curriculumId,
        duration_seconds: durationSeconds,
        started_at: sessionStartTime.current.toISOString(),
        ended_at: endTime.toISOString(),
      });

      // 2. If completed, update curriculum status and progress
      if (status === 'completed') {
        await (supabase.from('user_curriculum') as any)
          .update({ status: 'completed' })
          .eq('id', curriculumId);

        if (taskInfo) {
          await (supabase.from('progress') as any).upsert({
            user_id: userId,
            task_id: taskInfo.taskId,
            book_id: taskInfo.bookId,
            lap: 1,
            status: 'completed',
            score: isSkipped ? null : score,
          }, { onConflict: 'user_id,task_id,lap' });
        }
      }

      router.push('/curriculums');
    } catch (err) {
      console.error('Failed to save time log:', err);
      setError('学習記録の保存に失敗しました。');
      setIsActive(true);
      setIsScoreModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScoreSubmit = (score: number | null, isSkipped: boolean) => {
    setIsScoreModalOpen(false);
    submitTimeLog('completed', score, isSkipped);
  };

  if (authLoading || isLoading) {
    return (
      <div className="w-full max-w-lg mx-auto text-center p-8">
        <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto" />
        <p className="text-gray-600 dark:text-gray-300 mt-4">学習データを準備中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-lg text-center p-8 bg-red-100 dark:bg-red-900/50 rounded-lg animate-fade-in mt-8">
        <h2 className="text-2xl font-bold text-red-800 dark:text-red-200">エラー</h2>
        <p className="mt-2 text-red-600 dark:text-red-300">{error}</p>
        <button onClick={() => router.push('/curriculums')} className="mt-6 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg">
          ダッシュボードに戻る
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 animate-fade-in mt-8 text-center mx-auto">
        <div className="mb-8">
          {taskInfo?.bookImageUrl && (
            <img src={taskInfo.bookImageUrl} alt={taskInfo.name} className="w-24 h-32 object-contain rounded-md mx-auto mb-4" />
          )}
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            {taskInfo?.subjectName} &gt; {taskInfo?.divisionName}
          </p>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mt-2">{taskInfo?.name}</h1>
        </div>

        <div className="my-12">
          <p className="text-gray-500 dark:text-gray-400">今回の学習時間</p>
          <p className="text-7xl font-bold font-mono text-gray-800 dark:text-white tracking-widest">{formatTime(currentSessionSeconds)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">これまでの学習時間: {formatTime(totalElapsedSeconds)}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => setIsActive(!isActive)}
            disabled={isSubmitting}
            className={`w-full sm:w-auto text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 text-lg ${
              isActive ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {isActive ? '一時停止' : '再開'}
          </button>

          <button
            onClick={() => handleStopTimer('completed')}
            disabled={isSubmitting || !isActive}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '保存中...' : 'タスク完了'}
          </button>
        </div>

        <div className="mt-6">
          <button
            onClick={() => handleStopTimer('paused')}
            disabled={isSubmitting}
            className="text-sm text-gray-500 dark:text-gray-400 hover:underline disabled:opacity-50"
          >
            一旦やめる
          </button>
        </div>
      </div>

      <TestScoreModal
        isOpen={isScoreModalOpen}
        onClose={() => { setIsScoreModalOpen(false); setIsActive(true); }}
        onSubmit={handleScoreSubmit}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
