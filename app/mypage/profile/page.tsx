'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

type ProfileData = {
  nickname: string;
  targetCollege: string;
  grade: string;
  targetTime: number;
  learningLocation: string;
  phoneNumber: string;
  highSchool: string;
};

type SubjectItem = { id: string; name: string };

const gradeOptions: { [key: string]: string } = {
  '': '未設定',
  high_3: '高3生',
  high_2: '高2生',
  high_1: '高1生',
  ronin: '浪人生',
  junior_high: '中学生',
};

export default function ProfilePage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [userSubjects, setUserSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const fetchData = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('nickname, target_college, grade, target_time, learning_location, phone_number, high_school')
        .eq('id', currentUser.id)
        .single<{
          nickname: string | null;
          target_college: string | null;
          grade: string | null;
          target_time: number | null;
          learning_location: string | null;
          phone_number: string | null;
          high_school: string | null;
        }>();

      if (userError) throw new Error('プロフィール情報が見つかりません。');

      setProfile({
        nickname: userData.nickname || '',
        targetCollege: userData.target_college || '',
        grade: userData.grade || '',
        targetTime: userData.target_time || 0,
        learningLocation: userData.learning_location || 'classroom',
        phoneNumber: userData.phone_number || '',
        highSchool: userData.high_school || '',
      });

      // Fetch user's subjects via user_subjects join
      const { data: userSubjectsData } = await supabase
        .from('user_subjects')
        .select('subject_id, subjects(id, name)')
        .eq('user_id', currentUser.id) as { data: any[] | null };

      if (userSubjectsData) {
        const subjects = userSubjectsData
          .map((us: any) => us.subjects)
          .filter(Boolean)
          .map((s: any) => ({ id: s.id, name: s.name }));
        setUserSubjects(subjects);
      }
    } catch (err) {
      console.error('Failed to fetch profile data:', err);
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
    fetchData();
  }, [authLoading, currentUser, router, fetchData]);

  const handleProfileChange = (field: keyof Omit<ProfileData, 'learningLocation'>, value: string | number) => {
    setProfile(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !profile) return;

    setIsSubmitting(true);
    setSuccessMessage('');
    setError(null);

    try {
      const { error: updateError } = await (supabase.from('users') as any).update({
        nickname: profile.nickname,
        target_college: profile.targetCollege.trim(),
        grade: profile.grade,
        target_time: profile.targetTime,
        phone_number: profile.phoneNumber,
        high_school: profile.highSchool,
      }).eq('id', currentUser.id);

      if (updateError) throw updateError;

      setSuccessMessage('プロフィールが正常に更新されました。');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('プロフィールの更新に失敗しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-4xl text-center p-8 animate-fade-in mt-8">
        <div className="spinner mx-auto"></div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="w-full max-w-lg text-center p-8 bg-danger-100 dark:bg-danger-900/50 rounded-btn animate-fade-in mt-8">
        <h2 className="text-2xl font-bold text-danger-800 dark:text-danger-200">エラー</h2>
        <p className="mt-2 text-danger-600 dark:text-danger-300">{error}</p>
        <Link href="/mypage" className="btn-danger mt-6 inline-block">
          マイページに戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl card p-8 animate-fade-in mt-8">
      <div className="flex justify-between items-center mb-6 border-b dark:border-gray-800 pb-4">
        <h1 className="text-2xl font-bold text-gray-700 dark:text-gray-100 tracking-wider">プロフィール編集</h1>
        <Link href="/mypage" className="text-sm text-primary-600 dark:text-gray-400 hover:underline">&larr; マイページに戻る</Link>
      </div>
      {profile && (
        <form onSubmit={handleSaveChanges} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="nickname" className="label">ニックネーム</label>
              <input
                type="text"
                id="nickname"
                value={profile.nickname}
                onChange={e => handleProfileChange('nickname', e.target.value)}
                className="input mt-1 block w-full"
                required
              />
            </div>
            <div>
              <label htmlFor="phoneNumber" className="label">電話番号</label>
              <input
                type="tel"
                id="phoneNumber"
                value={profile.phoneNumber}
                onChange={e => handleProfileChange('phoneNumber', e.target.value)}
                className="input mt-1 block w-full"
                placeholder="09012345678"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="highSchool" className="label">高校名</label>
              <input
                type="text"
                id="highSchool"
                value={profile.highSchool}
                onChange={e => handleProfileChange('highSchool', e.target.value)}
                className="input mt-1 block w-full"
                placeholder="〇〇高校"
              />
            </div>
            <div>
              <label htmlFor="targetCollege" className="label">志望校</label>
              <input
                type="text"
                id="targetCollege"
                value={profile.targetCollege}
                onChange={e => handleProfileChange('targetCollege', e.target.value)}
                className="input mt-1 block w-full"
                placeholder="例: 早稲田大学政治経済学部"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="grade" className="label">学年</label>
              <select id="grade" value={profile.grade} onChange={e => handleProfileChange('grade', e.target.value)} className="input mt-1 block w-full">
                {Object.entries(gradeOptions).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="targetTime" className="label">1日の目標勉強時間</label>
              <select id="targetTime" value={profile.targetTime} onChange={e => handleProfileChange('targetTime', parseInt(e.target.value, 10))} className="input mt-1 block w-full">
                <option value={0}>未設定</option>
                {Array.from({ length: 16 }, (_, i) => i + 1).map(hour => (
                  <option key={hour} value={hour}>{hour}時間</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-input opacity-80">
            <div className="flex justify-between items-center mb-2">
              <span className="label">受講場所</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">（変更は管理者にご連絡ください）</span>
            </div>
            <p className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-input shadow-sm">
              {profile.learningLocation === 'classroom' ? '教室' : 'オンライン'}
            </p>
          </div>

          <div
            className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-input opacity-80 cursor-not-allowed"
            onClick={() => alert('カリキュラムが変更されるため、このページからは編集できません。\n変更は管理者にご連絡ください。')}
            title="編集はカリキュラム管理ページから行えます"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="label">受験科目</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">（編集不可）</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">カリキュラムに影響するため、変更は管理者にご連絡ください。</p>

            <div className="space-y-2">
              {userSubjects.length > 0 ? userSubjects.map(subject => (
                <div key={subject.id} className="p-3 bg-white dark:bg-gray-700 rounded-input shadow-sm">
                  <p className="font-medium text-gray-800 dark:text-gray-200">{subject.name}</p>
                </div>
              )) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">受験科目が設定されていません。</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 pt-4">
            {successMessage && <p className="text-sm text-success-600 dark:text-success-400 animate-fade-in">{successMessage}</p>}
            {error && <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="btn-primary px-6 py-2 disabled:bg-gray-400 transition-colors">
              {isSubmitting ? '保存中...' : '変更を保存'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
