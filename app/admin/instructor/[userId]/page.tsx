'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type InstructorProfile = {
  id: string;
  display_name: string;
  email: string;
  role: string;
  photo_url: string | null;
  created_at: string;
};

type ClassRecord = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
};

type AttendanceStat = {
  total_classes: number;
  recent_classes: ClassRecord[];
};

export default function InstructorDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser, loading: authLoading } = useAuth();
  const [instructor, setInstructor] = useState<InstructorProfile | null>(null);
  const [stats, setStats] = useState<AttendanceStat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (authLoading || !currentUser || !userId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();

        // Fetch instructor profile
        const { data: user, error: userError } = await (supabase.from('users') as any)
          .select('id, display_name, email, role, photo_url, created_at')
          .eq('id', userId)
          .single();

        if (userError || !user) throw new Error('講師が見つかりません。');
        setInstructor(user);
        setEditName(user.display_name);
        setEditRole(user.role);

        // Fetch attendance records (classes this instructor's students attended)
        // Since attendance_records links class_id and user_id, we get classes
        // where this instructor taught by checking classes they created or attended
        const { data: attendanceData } = await (supabase.from('attendance_records') as any)
          .select('class_id, classes(id, title, start_time, end_time)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);

        const classMap = new Map<string, ClassRecord>();
        (attendanceData || []).forEach((record: any) => {
          if (record.classes && !classMap.has(record.classes.id)) {
            classMap.set(record.classes.id, record.classes);
          }
        });

        const recentClasses = Array.from(classMap.values())
          .sort(
            (a, b) =>
              new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
          )
          .slice(0, 10);

        setStats({
          total_classes: classMap.size,
          recent_classes: recentClasses,
        });
      } catch (err) {
        console.error('Error fetching instructor data:', err);
        setError(err instanceof Error ? err.message : 'データ取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, authLoading, currentUser]);

  const handleSave = async () => {
    if (!instructor) return;
    setIsSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await (supabase.from('users') as any)
        .update({
          display_name: editName,
          role: editRole,
        })
        .eq('id', instructor.id);

      if (updateError) throw updateError;

      setInstructor({ ...instructor, display_name: editName, role: editRole });
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating instructor:', err);
      alert('更新に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-4xl text-center p-8 mx-auto mt-8">
        <div className="spinner mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-300 mt-4">読み込み中...</p>
      </div>
    );
  }

  if (error || !instructor) {
    return (
      <div className="w-full max-w-lg text-center p-8 bg-danger-100 dark:bg-danger-900/50 rounded-card mx-auto mt-8">
        <h2 className="text-2xl font-bold text-danger-800 dark:text-danger-200">エラー</h2>
        <p className="mt-2 text-danger-600 dark:text-danger-300">{error || '講師が見つかりません。'}</p>
        <Link
          href="/admin/instructors"
          className="btn-danger mt-6 inline-block"
        >
          講師一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 space-y-6 px-4 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center">
        <Link
          href="/admin/instructors"
          className="text-sm text-primary-600 dark:text-gray-400 hover:underline"
        >
          &larr; 講師一覧に戻る
        </Link>
      </div>

      {/* Profile Card */}
      <div className="card">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            {instructor.photo_url ? (
              <img
                src={instructor.photo_url}
                alt={instructor.display_name}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-gray-900/30 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary-600 dark:text-gray-400">
                  {instructor.display_name.charAt(0)}
                </span>
              </div>
            )}
          </div>
          <div className="flex-grow">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="label">
                    名前
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input mt-1"
                  />
                </div>
                <div>
                  <label className="label">
                    権限
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="input mt-1"
                  >
                    <option value="admin">admin (管理者)</option>
                    <option value="super">super (最高管理者)</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="btn-primary"
                  >
                    {isSaving ? '保存中...' : '保存'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(instructor.display_name);
                      setEditRole(instructor.role);
                    }}
                    className="btn-secondary"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-700 dark:text-gray-100 tracking-wider">
                    {instructor.display_name}
                  </h1>
                  <span className="badge-primary">
                    {instructor.role}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {instructor.email}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  登録日: {new Date(instructor.created_at).toLocaleDateString('ja-JP')}
                </p>
                {currentUser?.role === 'super' && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="btn-primary mt-3"
                  >
                    編集
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Activity Stats */}
      {stats && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-700 dark:text-gray-100 mb-4 border-b dark:border-gray-800 pb-3">
            活動履歴
          </h2>
          <div className="mb-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              担当授業数: <strong className="text-gray-800 dark:text-gray-100">{stats.total_classes}回</strong>
            </span>
          </div>

          {stats.recent_classes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      授業名
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      日時
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {stats.recent_classes.map((cls) => (
                    <tr key={cls.id}>
                      <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-100">
                        {cls.title}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(cls.start_time).toLocaleString('ja-JP')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              まだ活動履歴がありません。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
