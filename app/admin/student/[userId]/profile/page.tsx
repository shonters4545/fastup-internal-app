'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

const gradeOptions: Record<string, string> = {
  high_3: '高3生',
  high_2: '高2生',
  high_1: '高1生',
  ronin: '浪人生',
  junior_high: '中学生',
};

type SubjectItem = { id: string; name: string };

export default function AdminStudentProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [nickname, setNickname] = useState('');
  const [grade, setGrade] = useState('');
  const [targetCollege, setTargetCollege] = useState('');
  const [learningLocation, setLearningLocation] = useState('classroom');
  const [highSchool, setHighSchool] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [targetTime, setTargetTime] = useState<number>(0);

  const [allSubjects, setAllSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studentName, setStudentName] = useState('');

  useEffect(() => {
    if (authLoading || !currentUser || !userId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch user profile
        const { data: user } = await (supabase.from('users') as any)
          .select('*')
          .eq('id', userId)
          .single();
        if (user) {
          setNickname(user.nickname || '');
          setStudentName(user.nickname || '名前未設定');
          setGrade(user.grade || '');
          setTargetCollege(user.target_college || '');
          setLearningLocation(user.learning_location || 'classroom');
          setHighSchool(user.high_school || '');
          setPhoneNumber(user.phone_number || '');
          setParentEmail(user.parent_email || '');
          setTargetTime(user.target_time || 0);
        }

        // Fetch all subjects
        const { data: subjectsData } = await supabase.from('subjects').select('id, name').order('display_order');
        setAllSubjects((subjectsData || []) as SubjectItem[]);

        // Fetch user's current subjects with levels
        const { data: userSubs } = await (supabase.from('user_subjects') as any)
          .select('subject_id, level')
          .eq('user_id', userId);
        if (userSubs) {
          const subIds = (userSubs as any[]).map(us => us.subject_id);
          setSelectedSubjects(subIds);
          const lvls: Record<string, number> = {};
          (userSubs as any[]).forEach(us => {
            lvls[us.subject_id] = us.level || 1;
          });
          setLevels(lvls);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, currentUser, authLoading]);

  const handleSubjectToggle = (subjectId: string, checked: boolean) => {
    if (checked) {
      setSelectedSubjects(prev => [...prev, subjectId]);
      setLevels(prev => ({ ...prev, [subjectId]: 1 }));
    } else {
      setSelectedSubjects(prev => prev.filter(id => id !== subjectId));
      setLevels(prev => { const n = { ...prev }; delete n[subjectId]; return n; });
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      // Update user profile
      const { error: updateErr } = await (supabase.from('users') as any)
        .update({
          nickname,
          grade,
          target_college: targetCollege,
          learning_location: learningLocation,
          high_school: highSchool,
          phone_number: phoneNumber,
          parent_email: parentEmail,
          target_time: targetTime,
        })
        .eq('id', userId);
      if (updateErr) throw updateErr;

      // Update user_subjects: delete existing, insert new
      await (supabase.from('user_subjects') as any).delete().eq('user_id', userId);
      if (selectedSubjects.length > 0) {
        const rows = selectedSubjects.map(subjectId => ({
          user_id: userId,
          subject_id: subjectId,
          level: levels[subjectId] || 1,
        }));
        const { error: insertErr } = await (supabase.from('user_subjects') as any).insert(rows);
        if (insertErr) throw insertErr;
      }

      alert('プロフィールを保存しました。');
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl animate-fade-in mt-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4 gap-2">
        <Link href="/admin/students" className="hover:text-blue-600 dark:hover:text-blue-400">生徒一覧</Link>
        <span>/</span>
        <Link href={`/admin/student/${userId}`} className="hover:text-blue-600 dark:hover:text-blue-400">{studentName}</Link>
        <span>/</span>
        <span className="text-gray-800 dark:text-white font-medium">プロフィール</span>
      </nav>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">プロフィール編集</h1>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ニックネーム</label>
              <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">学年</label>
              <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                <option value="">未設定</option>
                {Object.entries(gradeOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">志望校</label>
              <input type="text" value={targetCollege} onChange={e => setTargetCollege(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">高校名</label>
              <input type="text" value={highSchool} onChange={e => setHighSchool(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">電話番号</label>
              <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">保護者メール</label>
              <input type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">1日の目標勉強時間 (時間)</label>
              <input type="number" min={0} step={0.5} value={targetTime} onChange={e => setTargetTime(parseFloat(e.target.value) || 0)} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md" />
            </div>
          </div>

          {/* Learning Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">受講場所</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="location" value="classroom" checked={learningLocation === 'classroom'} onChange={() => setLearningLocation('classroom')} className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">教室</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="location" value="online" checked={learningLocation === 'online'} onChange={() => setLearningLocation('online')} className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">オンライン</span>
              </label>
            </div>
          </div>

          {/* Subjects */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">受験科目</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {allSubjects.map(subject => (
                <label key={subject.id} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedSubjects.includes(subject.id)} onChange={e => handleSubjectToggle(subject.id, e.target.checked)} className="h-4 w-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700 dark:text-gray-200">{subject.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Skill Levels */}
          {selectedSubjects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">各科目のレベル</label>
              <div className="space-y-3">
                {selectedSubjects.map(subjectId => {
                  const subject = allSubjects.find(s => s.id === subjectId);
                  if (!subject) return null;
                  return (
                    <div key={subjectId} className="flex items-center gap-4">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 w-24">{subject.name}</span>
                      <div className="flex gap-4">
                        {[1, 2, 3].map(level => (
                          <label key={level} className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name={`level-${subjectId}`} checked={levels[subjectId] === level} onChange={() => setLevels(prev => ({ ...prev, [subjectId]: level }))} className="h-4 w-4 text-blue-600" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Lv.{level}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t dark:border-gray-700">
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-colors disabled:bg-gray-400">
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
