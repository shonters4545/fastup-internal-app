'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type ClassRow = {
  id: string;
  title: string;
  instructor_id: string | null;
  instructor_name: string | null;
  passcode: string | null;
  start_time: string;
  end_time: string;
  survey_sent: boolean;
};

type Instructor = {
  id: string;
  display_name: string;
};

// --- CreateClassModal ---
function CreateClassModal({
  instructors,
  onClose,
  onSuccess,
}: {
  instructors: Instructor[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [selectedInstructorId, setSelectedInstructorId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const timeOptions = useMemo(() => {
    const opts: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m++) {
        opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return opts;
  }, []);

  useEffect(() => {
    if (instructors.length > 0) setSelectedInstructorId(instructors[0].id);
    const now = new Date();
    now.setSeconds(0, 0);
    now.setMinutes(now.getMinutes() + 1);
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    setStartDate(now.toISOString().split('T')[0]);
    setStartTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    setEndDate(end.toISOString().split('T')[0]);
    setEndTime(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`);
  }, [instructors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !selectedInstructorId || !startDate || !startTime || !endDate || !endTime) {
      setError('すべての項目を入力してください。');
      return;
    }
    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);
    if (startDateTime >= endDateTime) {
      setError('終了時間は開始時間よりも後に設定してください。');
      return;
    }
    setIsSubmitting(true);
    try {
      const instructor = instructors.find((i) => i.id === selectedInstructorId);
      if (!instructor) throw new Error('Selected instructor not found.');
      const passcode = Math.floor(1000 + Math.random() * 9000).toString();
      const supabase = createClient();
      const { error: insertError } = await (supabase.from('classes') as any).insert({
        title: title.trim(),
        instructor_id: instructor.id,
        instructor_name: instructor.display_name,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        passcode,
        survey_sent: false,
      });
      if (insertError) throw insertError;
      onSuccess();
    } catch (err: any) {
      console.error('Error creating class:', err);
      setError('特訓の作成中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-6 text-gray-800 dark:text-white">新規特訓を開講</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">タイトル</label>
            <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-gray-900 dark:text-white" required />
          </div>
          <div>
            <label htmlFor="instructor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">担当講師</label>
            <select id="instructor" value={selectedInstructorId} onChange={(e) => setSelectedInstructorId(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-gray-900 dark:text-white" required>
              {instructors.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.display_name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">開始時間</label>
              <div className="flex gap-2 mt-1">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-grow p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-gray-900 dark:text-white" required />
                <select value={startTime} onChange={(e) => setStartTime(e.target.value)} className="p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-gray-900 dark:text-white" required>
                  {timeOptions.map((t) => <option key={`s-${t}`} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">終了時間</label>
              <div className="flex gap-2 mt-1">
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-grow p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-gray-900 dark:text-white" required />
                <select value={endTime} onChange={(e) => setEndTime(e.target.value)} className="p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-gray-900 dark:text-white" required>
                  {timeOptions.map((t) => <option key={`e-${t}`} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 bg-gray-200 dark:bg-gray-500 rounded-md text-sm text-gray-800 dark:text-white">キャンセル</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:bg-gray-400">
              {isSubmitting ? '開講中...' : '開講する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function AdminClassesPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [attendanceCounts, setAttendanceCounts] = useState<Map<string, number>>(new Map());
  const [responseCounts, setResponseCounts] = useState<Map<string, number>>(new Map());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [classesRes, instructorsRes, attendanceRes, responsesRes] = await Promise.all([
        (supabase.from('classes') as any).select('*').order('start_time', { ascending: false }),
        (supabase.from('users') as any).select('id, display_name').in('role', ['admin', 'super']),
        (supabase.from('attendance_records') as any).select('class_id'),
        (supabase.from('survey_responses') as any).select('class_id').eq('type', 'practice'),
      ]);
      if (classesRes.error) throw classesRes.error;
      if (instructorsRes.error) throw instructorsRes.error;

      setClasses(classesRes.data || []);
      setInstructors(instructorsRes.data || []);

      const aCounts = new Map<string, number>();
      (attendanceRes.data || []).forEach((r: any) => {
        aCounts.set(r.class_id, (aCounts.get(r.class_id) || 0) + 1);
      });
      setAttendanceCounts(aCounts);

      const rCounts = new Map<string, number>();
      (responsesRes.data || []).forEach((r: any) => {
        if (r.class_id) rCounts.set(r.class_id, (rCounts.get(r.class_id) || 0) + 1);
      });
      setResponseCounts(rCounts);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('データの取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  const handleSuccess = () => {
    setIsModalOpen(false);
    fetchData();
  };

  if (authLoading || loading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (!authLoading && currentUser && !['admin', 'super'].includes(currentUser.role)) {
    router.push('/');
    return null;
  }

  const now = new Date();

  return (
    <>
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 animate-fade-in mt-8">
        <div className="flex justify-between items-center mb-6 border-b dark:border-gray-700 pb-4">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">特訓管理</h1>
          <button onClick={() => setIsModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors">
            新規特訓を開講する
          </button>
        </div>

        {error ? (
          <div className="text-center text-red-500 py-12">{error}</div>
        ) : classes.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">登録されている特訓はありません。</div>
        ) : (
          <div className="space-y-4">
            {classes.map((cls) => {
              const startTime = new Date(cls.start_time);
              const endTime = new Date(cls.end_time);
              let statusText: string;
              let statusStyle: string;
              let isFinished = false;

              if (endTime <= now) {
                isFinished = true;
                statusText = '終了済み';
                statusStyle = 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-300';
              } else if (startTime <= now && endTime > now) {
                statusText = '実施中';
                statusStyle = 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-200 animate-pulse';
              } else {
                statusText = '実施予定';
                statusStyle = 'bg-blue-200 text-blue-800 dark:bg-blue-700 dark:text-blue-200';
              }

              const requestedCount = attendanceCounts.get(cls.id) || 0;
              const respondedCount = responseCounts.get(cls.id) || 0;

              return (
                <div key={cls.id} className={`bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isFinished ? 'opacity-60' : ''}`}>
                  <div className="flex-grow w-full">
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-lg font-bold text-gray-800 dark:text-white">{cls.title}</h2>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusStyle}`}>{statusText}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">講師: {cls.instructor_name || '未設定'}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {startTime.toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} - {endTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 self-end sm:self-center">
                    {!isFinished && cls.passcode && (
                      <div className="text-left sm:text-right">
                        <p className="text-sm text-gray-600 dark:text-gray-300">パスコード</p>
                        <p className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 tracking-widest">{cls.passcode}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {isFinished && (
                        <div className="flex items-center">
                          {requestedCount > 0 && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">({respondedCount}/{requestedCount})</span>
                          )}
                          <Link href={`/admin/classes/${cls.id}/surveys`} className="ml-2 px-4 py-2 text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors">
                            アンケート結果
                          </Link>
                        </div>
                      )}
                      <Link href={`/admin/classes/${cls.id}/attendance`} className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500 text-gray-800 dark:text-white">
                        出席者一覧
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <CreateClassModal instructors={instructors} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} />
      )}
    </>
  );
}
