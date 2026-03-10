'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type ClassInfo = {
  title: string;
  instructor_name: string | null;
  start_time: string;
  end_time: string;
};

type Attendee = {
  id: string;
  student_name: string | null;
  attended_at: string | null;
  instructor_name: string | null;
  study_material: string | null;
  user_id: string;
};

export default function AdminClassAttendancePage() {
  const { classId } = useParams<{ classId: string }>();
  const { currentUser, loading: authLoading } = useAuth();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!classId) {
      setError('特訓IDが見つかりません。');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Fetch class info
      const { data: classData, error: classError } = await (supabase.from('classes') as any)
        .select('title, instructor_name, start_time, end_time')
        .eq('id', classId)
        .single();
      if (classError) throw new Error('特訓情報が見つかりません。');
      setClassInfo(classData);

      // Fetch attendance records with user info
      const { data: attendanceData, error: attendanceError } = await (supabase.from('attendance_records') as any)
        .select('id, user_id, instructor_name, student_name, study_material, attended_at')
        .eq('class_id', classId)
        .order('attended_at', { ascending: true });
      if (attendanceError) throw attendanceError;

      // If student_name is null, fetch from users table
      const records = attendanceData || [];
      const missingNameIds = records.filter((r: any) => !r.student_name).map((r: any) => r.user_id);
      if (missingNameIds.length > 0) {
        const { data: usersData } = await (supabase.from('users') as any)
          .select('id, display_name')
          .in('id', missingNameIds);
        const userMap = new Map((usersData || []).map((u: any) => [u.id, u.display_name]));
        records.forEach((r: any) => {
          if (!r.student_name && userMap.has(r.user_id)) {
            r.student_name = userMap.get(r.user_id);
          }
        });
      }

      setAttendees(records);
    } catch (err) {
      console.error('Error fetching class attendance:', err);
      setError(err instanceof Error ? err.message : 'データ取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  // Group attendees by instructor
  const groupedAttendees = useMemo(() => {
    const map = new Map<string, Attendee[]>();
    attendees.forEach((a) => {
      const key = a.instructor_name || '（未設定）';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [attendees]);

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-4xl text-center p-8 animate-fade-in mt-8 mx-auto">
        <div className="w-12 h-12 border-4 border-teal-500 border-dashed rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-500 mt-4">出席者情報を読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-lg text-center p-8 bg-red-100 dark:bg-red-900/50 rounded-lg animate-fade-in mt-8 mx-auto">
        <h2 className="text-2xl font-bold text-red-800 dark:text-red-200">エラー</h2>
        <p className="mt-2 text-red-600 dark:text-red-300">{error}</p>
        <Link href="/admin/classes" className="mt-6 inline-block bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg">
          特訓管理に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 animate-fade-in mt-8 mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start mb-8 border-b dark:border-gray-700 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">出席者一覧</h1>
          {classInfo && (
            <div className="mt-2 space-y-1">
              <p className="text-xl font-semibold text-teal-600 dark:text-teal-400">{classInfo.title}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                開催日時: {new Date(classInfo.start_time).toLocaleString('ja-JP')} 〜 {new Date(classInfo.end_time).toLocaleTimeString('ja-JP')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">メイン講師: {classInfo.instructor_name || '未設定'}</p>
            </div>
          )}
        </div>
        <Link href="/admin/classes" className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0">&larr; 特訓管理に戻る</Link>
      </div>

      <div className="mb-6 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
        <div className="text-lg font-bold text-gray-700 dark:text-gray-200">
          総出席者数: <span className="text-2xl text-teal-600 dark:text-teal-400 ml-1">{attendees.length}</span> 名
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          講師数: {groupedAttendees.length} 名
        </div>
      </div>

      {attendees.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">この特訓の出席者はまだ記録されていません。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {groupedAttendees.map(([instructor, students]) => (
            <div key={instructor} className="bg-white dark:bg-gray-700 rounded-2xl shadow-md border border-gray-100 dark:border-gray-600 overflow-hidden flex flex-col">
              <div className="bg-teal-50 dark:bg-teal-900/30 px-6 py-4 border-b border-teal-100 dark:border-teal-800 flex justify-between items-center">
                <h3 className="font-bold text-teal-800 dark:text-teal-200 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  {instructor} 先生
                </h3>
                <span className="bg-white dark:bg-teal-800 px-2 py-0.5 rounded text-xs font-bold text-teal-600 dark:text-teal-300">
                  {students.length}名
                </span>
              </div>
              <div className="flex-grow">
                <ul className="divide-y divide-gray-100 dark:divide-gray-600">
                  {students.map((attendee) => (
                    <li key={attendee.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-600/50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <Link href={`/admin/student/${attendee.user_id}`} className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
                          {attendee.student_name || '（名前未設定）'}
                        </Link>
                        {attendee.attended_at && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                            {new Date(attendee.attended_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded text-sm text-gray-600 dark:text-gray-300">
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 block mb-1">使用教材:</span>
                        {attendee.study_material || '（未入力）'}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
