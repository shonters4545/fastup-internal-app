'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

type Student = {
  id: string;
  nickname: string | null;
  learning_location: string | null;
  grade: string | null;
  target_college: string | null;
  subject_names: string[];
  subject_ids: string[];
};

type SubjectItem = {
  id: string;
  name: string;
};

const paymentMethodOptions: Record<string, string> = {
  bank_transfer_lump: '銀行振込　一括',
  bank_transfer_monthly: '銀行振込　月額',
  credit_card_lump: 'クレジット　一括',
  credit_card_monthly: 'クレジット　月額',
};

const gradeOptions: Record<string, string> = {
  high_3: '高3生',
  high_2: '高2生',
  high_1: '高1生',
  ronin: '浪人生',
  junior_high: '中学生',
};

type ActiveFilters = {
  learningLocation: '' | 'classroom' | 'online';
  grade: string;
  subjects: string[];
};

// --- Registration Modal ---
function RegistrationModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer_lump');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [targetCollege, setTargetCollege] = useState('');
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [grade, setGrade] = useState('high_3');
  const [learningLocation, setLearningLocation] = useState<'classroom' | 'online'>('classroom');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [highSchool, setHighSchool] = useState('');

  useEffect(() => {
    const fetchSubjects = async () => {
      const { data } = await supabase.from('subjects').select('id, name').order('display_order');
      if (data) setSubjects(data as SubjectItem[]);
    };
    fetchSubjects();
    const today = new Date();
    setStartDate(today.toISOString().split('T')[0]);
    const nextMonth = new Date(new Date().setMonth(today.getMonth() + 1));
    setEndDate(nextMonth.toISOString().split('T')[0]);
  }, []);

  const handleSubjectChange = (subjectId: string, checked: boolean) => {
    if (checked) {
      setSelectedSubjects(prev => [...prev, subjectId]);
      setLevels(prev => ({ ...prev, [subjectId]: 1 }));
    } else {
      setSelectedSubjects(prev => prev.filter(id => id !== subjectId));
      setLevels(prev => { const n = { ...prev }; delete n[subjectId]; return n; });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !startDate || !endDate || !targetCollege.trim() || selectedSubjects.length === 0 || !grade) {
      setError('すべての必須項目を入力してください。');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      // Insert invite record
      const { error: insertError } = await (supabase.from('invites') as any).insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        status: 'pending',
        payment_method: paymentMethod,
        contract_start_date: startDate,
        contract_end_date: endDate,
        target_college: targetCollege.trim(),
        subjects: selectedSubjects,
        levels,
        grade,
        learning_location: learningLocation,
        phone_number: phoneNumber.trim(),
        parent_email: parentEmail.trim().toLowerCase(),
        high_school: highSchool.trim(),
      });
      if (insertError) throw insertError;

      // Send invite email via API route
      try {
        const appUrl = `${window.location.origin}/login`;
        const emailRes = await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email.trim().toLowerCase(),
            subject: '【重要】FAST-UP塾生アプリ 招待のご案内',
            html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #333; text-align: center;">FAST-UP塾生アプリへようこそ！</h2>
              <p>${name} 様</p>
              <p>FAST-UP 運営事務局です。</p>
              <p>塾生専用アプリへの招待が完了しました。以下のボタンからログインして、初期設定を完了させてください。</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">アプリにログインする</a>
              </div>
              <p style="font-size: 14px; color: #666;">※ ログインには、招待を受けたこのメールアドレス（${email}）のGoogleアカウントを使用してください。</p>
            </div>`,
          }),
        });
        if (!emailRes.ok) {
          const errBody = await emailRes.json().catch(() => ({}));
          console.error('Email API error:', emailRes.status, errBody);
          alert(`招待情報は保存されましたが、メール送信に失敗しました: ${errBody.error || emailRes.statusText}`);
        }
      } catch (emailErr) {
        console.error('Email send network error:', emailErr);
        alert('招待情報は保存されましたが、メール送信に失敗しました（ネットワークエラー）。');
      }

      alert('生徒を招待リストに登録しました。');
      onSuccess();
    } catch (err) {
      console.error('Error creating invite:', err);
      setError('登録中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-6 text-primary-800 dark:text-warm-100">生徒の新規登録と招待</h3>
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="label">生徒名</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">生徒メールアドレス</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" required />
          </div>

          <div className="pt-4 border-t dark:border-primary-800">
            <h4 className="text-lg font-semibold mb-3 text-primary-800 dark:text-warm-100">基本情報</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">電話番号</label>
                <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="input" placeholder="09012345678" />
              </div>
              <div>
                <label className="label">高校名</label>
                <input type="text" value={highSchool} onChange={e => setHighSchool(e.target.value)} className="input" placeholder="〇〇高校" />
              </div>
              <div>
                <label className="label">学年</label>
                <select value={grade} onChange={e => setGrade(e.target.value)} className="input" required>
                  {Object.entries(gradeOptions).map(([key, value]) => (
                    <option key={key} value={key}>{value}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <span className="label">受験科目</span>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                {subjects.map(subject => (
                  <div className="flex items-center" key={subject.id}>
                    <input type="checkbox" value={subject.id} className="h-4 w-4 text-primary-600 border-warm-300 rounded" onChange={e => handleSubjectChange(subject.id, e.target.checked)} />
                    <label className="ml-3 block text-sm font-medium text-primary-700 dark:text-warm-200">{subject.name}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="label">志望校</label>
              <input type="text" value={targetCollege} onChange={e => setTargetCollege(e.target.value)} className="input" placeholder="例: 早稲田大学政治経済学部" required />
            </div>

            {selectedSubjects.length > 0 && (
              <div className="mt-4">
                <span className="label">各科目の学力を選択</span>
                <div className="mt-2 space-y-3">
                  {selectedSubjects.map(subjectId => {
                    const subject = subjects.find(s => s.id === subjectId);
                    if (!subject) return null;
                    return (
                      <fieldset key={subject.id}>
                        <legend className="text-sm font-medium text-primary-800 dark:text-warm-200 mb-1">{subject.name}</legend>
                        <div className="flex items-center space-x-6">
                          {[1, 2, 3].map(level => (
                            <div className="flex items-center" key={level}>
                              <input type="radio" name={`${subject.id}-level`} checked={levels[subject.id] === level} onChange={() => setLevels(prev => ({ ...prev, [subject.id]: level }))} className="h-4 w-4 text-primary-600 border-warm-300" />
                              <label className="ml-2 block text-sm font-medium text-primary-700 dark:text-warm-300">レベル{level}</label>
                            </div>
                          ))}
                        </div>
                      </fieldset>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="label">受講場所</label>
              <div className="mt-2 flex gap-4">
                <div className="flex items-center">
                  <input type="radio" name="learningLocation" value="classroom" checked={learningLocation === 'classroom'} onChange={() => setLearningLocation('classroom')} className="h-4 w-4 text-primary-600 border-warm-300" />
                  <label className="ml-2 block text-sm font-medium text-primary-700 dark:text-warm-300">教室</label>
                </div>
                <div className="flex items-center">
                  <input type="radio" name="learningLocation" value="online" checked={learningLocation === 'online'} onChange={() => setLearningLocation('online')} className="h-4 w-4 text-primary-600 border-warm-300" />
                  <label className="ml-2 block text-sm font-medium text-primary-700 dark:text-warm-300">オンライン</label>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t dark:border-primary-800">
            <h4 className="text-lg font-semibold mb-3 text-primary-800 dark:text-warm-100">契約情報</h4>
            <div>
              <label className="label">保護者Gmailアドレス</label>
              <input type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)} className="input" placeholder="example@gmail.com" />
            </div>
            <div className="mt-4">
              <label className="label">支払い方法</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="input">
                {Object.entries(paymentMethodOptions).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">契約開始日</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">契約終了日</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input" required />
          </div>
          {error && <p className="text-sm text-danger-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="btn-secondary">キャンセル</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary disabled:bg-warm-400">
              {isSubmitting ? '登録中...' : '登録して招待'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Invited Students Modal ---
function InvitedStudentsModal({ onClose }: { onClose: () => void }) {
  const supabase = createClient();
  const [invites, setInvites] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchInvites = async () => {
    setLoading(true);
    const { data } = await (supabase.from('invites') as any).select('id, name, email').eq('status', 'pending');
    setInvites((data || []) as { id: string; name: string; email: string }[]);
    setLoading(false);
  };

  useEffect(() => { fetchInvites(); }, []);

  const handleDelete = async (inviteId: string) => {
    if (!window.confirm('本当にこの招待を取り消しますか？')) return;
    setIsDeleting(inviteId);
    await (supabase.from('invites') as any).delete().eq('id', inviteId);
    fetchInvites();
    setIsDeleting(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-6 text-primary-800 dark:text-warm-100">招待中の生徒</h3>
        {loading ? (
          <p className="text-center text-warm-500 dark:text-warm-400">読み込み中...</p>
        ) : invites.length === 0 ? (
          <p className="text-center text-warm-500 dark:text-warm-400">現在、招待中の生徒はいません。</p>
        ) : (
          <ul className="divide-y divide-warm-200 dark:divide-primary-800 max-h-80 overflow-y-auto">
            {invites.map(invite => (
              <li key={invite.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-primary-800 dark:text-warm-100">{invite.name}</p>
                  <p className="text-sm text-warm-500 dark:text-warm-400">{invite.email}</p>
                </div>
                <button onClick={() => handleDelete(invite.id)} disabled={isDeleting === invite.id} className="px-3 py-1 text-sm bg-danger-100 text-danger-700 dark:bg-danger-900/40 dark:text-danger-200 rounded-badge hover:bg-danger-200 dark:hover:bg-danger-900/60 transition-colors disabled:opacity-50">
                  {isDeleting === invite.id ? '取消中...' : '招待を取り消し'}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end pt-4 mt-4 border-t dark:border-primary-800">
          <button type="button" onClick={onClose} className="btn-secondary">閉じる</button>
        </div>
      </div>
    </div>
  );
}

// --- Filter Modal ---
function FilterModal({ isOpen, onClose, onApply, subjects, currentFilters }: {
  isOpen: boolean;
  onClose: () => void;
  onApply: (f: ActiveFilters) => void;
  subjects: SubjectItem[];
  currentFilters: ActiveFilters;
}) {
  const [filters, setFilters] = useState<ActiveFilters>(currentFilters);

  useEffect(() => { setFilters(currentFilters); }, [isOpen, currentFilters]);

  if (!isOpen) return null;

  const handleReset = () => {
    const reset: ActiveFilters = { learningLocation: '', grade: '', subjects: [] };
    setFilters(reset);
    onApply(reset);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-6 text-primary-800 dark:text-warm-100">絞り込み条件</h3>
        <div className="space-y-4">
          <div>
            <label className="label">受講場所</label>
            <select value={filters.learningLocation} onChange={e => setFilters({ ...filters, learningLocation: e.target.value as '' | 'classroom' | 'online' })} className="input">
              <option value="">すべての場所</option>
              <option value="classroom">教室</option>
              <option value="online">オンライン</option>
            </select>
          </div>
          <div>
            <label className="label">学年</label>
            <select value={filters.grade} onChange={e => setFilters({ ...filters, grade: e.target.value })} className="input">
              <option value="">すべての学年</option>
              {Object.entries(gradeOptions).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
            </select>
          </div>
          <div>
            <span className="label">受験科目（AND検索）</span>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
              {subjects.map(subject => (
                <div className="flex items-center" key={subject.id}>
                  <input type="checkbox" checked={filters.subjects.includes(subject.id)} onChange={e => {
                    const newSubs = e.target.checked ? [...filters.subjects, subject.id] : filters.subjects.filter(id => id !== subject.id);
                    setFilters({ ...filters, subjects: newSubs });
                  }} className="h-4 w-4 text-primary-600 border-warm-300 rounded" />
                  <label className="ml-3 block text-sm font-medium text-primary-700 dark:text-warm-200">{subject.name}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center gap-2 pt-6 mt-4 border-t dark:border-primary-800">
          <button type="button" onClick={handleReset} className="px-4 py-2 text-danger-600 dark:text-danger-400 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded-btn text-sm">条件をリセット</button>
          <div>
            <button type="button" onClick={onClose} className="btn-secondary mr-2">キャンセル</button>
            <button type="button" onClick={() => onApply(filters)} className="btn-primary">この条件で絞り込む</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function AdminStudentListPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ learningLocation: '', grade: '', subjects: [] });

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch students
      const { data: studentsData, error: studentsErr } = await (supabase.from('users') as any)
        .select('id, nickname, learning_location, grade, target_college')
        .eq('role', 'student');
      if (studentsErr) throw studentsErr;

      // Fetch subjects
      const { data: subjectsData } = await supabase.from('subjects').select('id, name').order('display_order');
      const subjectsList = (subjectsData || []) as SubjectItem[];
      setSubjects(subjectsList);
      const subjectsMap = new Map(subjectsList.map(s => [s.id, s.name]));

      // Fetch user_subjects
      const { data: userSubjectsData } = await (supabase.from('user_subjects') as any).select('user_id, subject_id');
      const userSubjectsMap = new Map<string, string[]>();
      ((userSubjectsData || []) as { user_id: string; subject_id: string }[]).forEach(us => {
        const list = userSubjectsMap.get(us.user_id) || [];
        list.push(us.subject_id);
        userSubjectsMap.set(us.user_id, list);
      });

      const students: Student[] = ((studentsData || []) as any[]).map(s => {
        const subjectIds = userSubjectsMap.get(s.id) || [];
        return {
          id: s.id,
          nickname: s.nickname,
          learning_location: s.learning_location,
          grade: s.grade,
          target_college: s.target_college,
          subject_ids: subjectIds,
          subject_names: subjectIds.map(id => subjectsMap.get(id) || id),
        };
      });

      setAllStudents(students);
    } catch (err) {
      console.error('Error fetching students:', err);
      setError('生徒リストの取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser || !['admin', 'super'].includes(currentUser.role || '')) {
      setError('このページにアクセスする権限がありません。');
      setLoading(false);
      return;
    }
    fetchStudents();
  }, [currentUser, authLoading]);

  const handleDeleteStudent = async (studentId: string, nickname: string) => {
    if (!window.confirm(`${nickname} さんのデータを完全に削除します。よろしいですか？\n※この操作は取り消せません。`)) return;
    try {
      await (supabase.from('users') as any).delete().eq('id', studentId);
      setAllStudents(prev => prev.filter(s => s.id !== studentId));
      alert('生徒を削除しました。');
    } catch (err) {
      console.error('Error deleting student:', err);
      alert('削除に失敗しました。');
    }
  };

  const filteredStudents = useMemo(() => {
    return allStudents.filter(student => {
      const nameMatch = searchTerm ? (student.nickname || '').toLowerCase().includes(searchTerm.toLowerCase()) : true;
      const locationMatch = activeFilters.learningLocation ? student.learning_location === activeFilters.learningLocation : true;
      const gradeMatch = activeFilters.grade ? student.grade === activeFilters.grade : true;
      const subjectsMatch = activeFilters.subjects.length > 0
        ? activeFilters.subjects.every(subId => student.subject_ids.includes(subId))
        : true;
      return nameMatch && locationMatch && gradeMatch && subjectsMatch;
    });
  }, [allStudents, searchTerm, activeFilters]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(searchInput);
  };

  if (loading || authLoading) {
    return (
      <div className="text-center text-warm-500 dark:text-warm-400 py-12">
        <div className="spinner mx-auto mb-4" />
        <p>読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-danger-500 dark:text-danger-400 py-12"><p>{error}</p></div>;
  }

  return (
    <>
      <div className="w-full max-w-4xl card animate-fade-in mt-8">
        <div className="flex justify-between items-center mb-6 border-b dark:border-primary-800 pb-4">
          <h1 className="text-3xl font-bold text-primary-800 dark:text-warm-100">生徒一覧</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsInviteModalOpen(true)} className="btn-accent">招待中の生徒</button>
            <button onClick={() => setIsRegisterModalOpen(true)} className="btn-primary">生徒を新規登録</button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4 p-4 bg-warm-50 dark:bg-primary-950/50 rounded-btn">
          <form onSubmit={handleSearch} className="flex-grow flex gap-2">
            <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="生徒名で検索..." className="input flex-grow" />
            <button type="submit" className="btn-primary">検索する</button>
          </form>
          <button onClick={() => setIsFilterModalOpen(true)} className="btn-secondary">絞り込む</button>
        </div>

        <div className="overflow-hidden rounded-input bg-white dark:bg-primary-900">
          {filteredStudents.length === 0 ? (
            <div className="text-center text-warm-500 dark:text-warm-400 py-12"><p>表示する生徒がいません。</p></div>
          ) : (
            <ul className="divide-y divide-warm-200 dark:divide-primary-800">
              {filteredStudents.map(student => (
                <li key={student.id} className="group relative">
                  <div className="flex items-center">
                    <Link href={`/admin/student/${student.id}`} className="flex-grow block px-4 py-4 sm:px-6 hover:bg-warm-50 dark:hover:bg-primary-800/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-primary-800 dark:text-warm-100 truncate">{student.nickname || '（ニックネーム未設定）'}</p>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-badge whitespace-nowrap ${student.learning_location === 'classroom' ? 'badge-info' : 'badge-primary'}`}>
                            {student.learning_location === 'classroom' ? '教室' : 'オンライン'}
                          </span>
                          {student.subject_names.map((name, i) => (
                            <span key={i} className="text-xs font-semibold px-2 py-1 badge-danger whitespace-nowrap">{name}</span>
                          ))}
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={() => handleDeleteStudent(student.id, student.nickname || '名前なし')}
                      className="mr-4 p-2 text-danger-600 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded-btn transition-all sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isRegisterModalOpen && <RegistrationModal onClose={() => setIsRegisterModalOpen(false)} onSuccess={() => { setIsRegisterModalOpen(false); fetchStudents(); }} />}
      {isInviteModalOpen && <InvitedStudentsModal onClose={() => setIsInviteModalOpen(false)} />}
      <FilterModal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} onApply={f => { setActiveFilters(f); setIsFilterModalOpen(false); }} subjects={subjects} currentFilters={activeFilters} />
    </>
  );
}
