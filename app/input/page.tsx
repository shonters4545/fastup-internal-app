'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

type DataItem = { id: string; name: string };

export default function InputPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [subjects, setSubjects] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [nickname, setNickname] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [targetCollege, setTargetCollege] = useState('');
  const [levels, setLevels] = useState<{ [key: string]: number }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('subjects')
          .select('id, name')
          .order('name', { ascending: true });

        if (error) throw error;
        setSubjects(data || []);
      } catch (error) {
        console.error('Error fetching data from Supabase:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value: subjectId, checked } = e.target;

    setSelectedSubjects(currentSelected => {
      const isPresent = currentSelected.includes(subjectId);
      if (checked && !isPresent) {
        if (currentSelected.length >= 3) {
          e.target.checked = false;
          alert('受験科目は3つまで選択できます。');
          return currentSelected;
        }
        setLevels(currentLevels => ({ ...currentLevels, [subjectId]: 1 }));
        return [...currentSelected, subjectId];
      } else if (!checked && isPresent) {
        setLevels(currentLevels => {
          const newLevels = { ...currentLevels };
          delete newLevels[subjectId];
          return newLevels;
        });
        return currentSelected.filter(id => id !== subjectId);
      }
      return currentSelected;
    });
  };

  const handleLevelChange = (subjectId: string, level: number) => {
    setLevels(prev => ({ ...prev, [subjectId]: level }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!currentUser) {
      alert('ログインしていません。');
      router.push('/login');
      return;
    }

    if (!nickname.trim() || !targetCollege.trim() || selectedSubjects.length === 0) {
      alert('ニックネーム、志望校、および受験科目を1つ以上選択してください。');
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      // 1. Update user profile
      const { error: userError } = await (supabase.from('users') as any).update({
        nickname: nickname.trim(),
        target_college: targetCollege.trim(),
        profile_completed: true,
      }).eq('id', currentUser.id);

      if (userError) throw userError;

      // 2. Delete existing user_subjects for this user, then insert new ones
      await (supabase.from('user_subjects') as any).delete().eq('user_id', currentUser.id);

      const userSubjectsData = selectedSubjects.map(subjectId => ({
        user_id: currentUser.id,
        subject_id: subjectId,
      }));

      if (userSubjectsData.length > 0) {
        const { error: subjectsError } = await (supabase.from('user_subjects') as any).insert(userSubjectsData);
        if (subjectsError) throw subjectsError;
      }

      // 3. Insert level records for each selected subject
      // Delete existing levels first
      await (supabase.from('levels') as any).delete().eq('user_id', currentUser.id);

      const levelsData = selectedSubjects
        .filter(subjectId => levels[subjectId])
        .map(subjectId => ({
          user_id: currentUser.id,
          subject_id: subjectId,
          level: levels[subjectId],
        }));

      if (levelsData.length > 0) {
        const { error: levelsError } = await (supabase.from('levels') as any).insert(levelsData);
        if (levelsError) throw levelsError;
      }

      alert('プロフィールを正常に保存しました。');
      router.push('/mypage');
    } catch (error) {
      console.error('Error submitting profile:', error);
      alert('プロファイルの保存中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-md card p-8 animate-fade-in mt-8 text-center">
        <div className="spinner mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-300 mt-4">Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md card p-8 animate-fade-in mt-8 mx-auto">
      <h1 className="text-2xl font-bold text-gray-700 dark:text-gray-100 tracking-wider mb-6 text-center">プロフィール情報入力</h1>
      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Nickname */}
        <div>
          <label htmlFor="nickname" className="label">
            ニックネーム
          </label>
          <div className="mt-1">
            <input
              type="text"
              name="nickname"
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="input block w-full"
              placeholder="例: ワセダ太郎"
              required
            />
          </div>
        </div>

        {/* Subjects */}
        <div>
          <span className="label">
            受験科目（3つまで選択）
          </span>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
            {subjects.map(subject => (
              <div className="flex items-center" key={subject.id}>
                <input
                  id={`subject-${subject.id}`}
                  name="subjects"
                  type="checkbox"
                  value={subject.id}
                  className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded"
                  onChange={handleSubjectChange}
                  disabled={selectedSubjects.length >= 3 && !selectedSubjects.includes(subject.id)}
                />
                <label
                  htmlFor={`subject-${subject.id}`}
                  className={`ml-3 block text-sm font-medium text-gray-700 dark:text-gray-200 ${
                    selectedSubjects.length >= 3 && !selectedSubjects.includes(subject.id)
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                >
                  {subject.name}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* University */}
        <div>
          <label htmlFor="university" className="label">
            志望校
          </label>
          <input
            type="text"
            name="university"
            id="university"
            value={targetCollege}
            onChange={(e) => setTargetCollege(e.target.value)}
            className="input mt-1 block w-full"
            placeholder="例: 早稲田大学政治経済学部"
            required
          />
        </div>

        {/* Skill Level */}
        {selectedSubjects.length > 0 && (
          <div>
            <span className="label">
              各科目の学力を選択
            </span>
            <div className="mt-2 space-y-4">
              {selectedSubjects.map(subjectId => {
                const subject = subjects.find(s => s.id === subjectId);
                if (!subject) return null;
                return (
                  <fieldset key={subject.id}>
                    <legend className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">{subject.name}</legend>
                    <div className="flex items-center space-x-6">
                      {[1, 2, 3].map(level => (
                        <div className="flex items-center" key={level}>
                          <input
                            id={`${subject.id}-level-${level}`}
                            name={`${subject.id}-level`}
                            type="radio"
                            value={level}
                            checked={levels[subject.id] === level}
                            onChange={() => handleLevelChange(subject.id, level)}
                            className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300"
                          />
                          <label
                            htmlFor={`${subject.id}-level-${level}`}
                            className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                          >
                            レベル{level}
                          </label>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-2 mt-4 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '登録中...' : '登録する'}
          </button>
        </div>
      </form>
    </div>
  );
}
