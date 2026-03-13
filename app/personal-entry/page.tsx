'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type ExistingEntry = {
  id: string;
  status: 'applied' | 'contracted' | 'pending_addition';
  contracted_subjects?: string[];
  phone_number?: string;
};

type Subject = {
  id: string;
  name: string;
};

const statusMap: { [key: string]: string } = {
  applied: '申込完了',
  contracted: '契約完了',
  pending_addition: '追加申請中',
};

export default function PersonalEntryPage() {
  const { currentUser } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [existingEntry, setExistingEntry] = useState<ExistingEntry | null>(null);
  const [desiredSubject, setDesiredSubject] = useState('');
  const [additionalSubject, setAdditionalSubject] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!currentUser) return;
      setLoading(true);
      try {
        const supabase = createClient();

        // Fetch subjects
        const { data: subjectsData, error: subjectsError } = await supabase
          .from('subjects')
          .select('id, name');
        if (subjectsError) throw subjectsError;
        setSubjects(subjectsData || []);

        // Check for existing personal entry
        const { data: entriesData, error: entriesError } = await supabase
          .from('personal_entries')
          .select('id, status, contracted_subjects, phone_number')
          .eq('user_id', currentUser.id);
        if (entriesError) throw entriesError;

        if (entriesData && entriesData.length > 0) {
          const entryData = entriesData[0] as ExistingEntry;
          setExistingEntry(entryData);
          setPhoneNumber(entryData.phone_number || '');
        }
      } catch (err) {
        console.error('Error fetching initial data:', err);
        setError('情報の確認中にエラーが発生しました。');
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchInitialData();
    }
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setError('ログインが必要です。');
      return;
    }
    if (!desiredSubject) {
      setError('希望科目を選択してください。');
      return;
    }
    if (!/^\d{10,11}$/.test(phoneNumber)) {
      setError('有効な電話番号（10桁または11桁の数字）を入力してください。');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await (supabase.from('personal_entries') as any).insert({
        user_id: currentUser.id,
        desired_subjects: [desiredSubject],
        phone_number: phoneNumber,
        status: 'applied',
        created_at: new Date().toISOString(),
      });
      if (error) throw error;

      alert('個別講義の申請が完了しました。');
      router.push('/');
    } catch (err) {
      console.error('Error submitting personal entry:', err);
      setError('申請処理中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdditionalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !existingEntry) return;

    if (!additionalSubject) {
      setError('追加希望科目を選択してください。');
      return;
    }
    if (!/^\d{10,11}$/.test(phoneNumber)) {
      setError('有効な電話番号（10桁または11桁の数字）を入力してください。');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await (supabase.from('personal_entries') as any)
        .update({
          status: 'pending_addition',
          additional_desired_subject: additionalSubject,
          phone_number: phoneNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingEntry.id);
      if (error) throw error;

      alert('個別講義の追加申請が完了しました。');
      router.push('/');
    } catch (err) {
      console.error('Error submitting additional entry:', err);
      setError('追加申請の処理中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-md card p-8 animate-fade-in mt-8 text-center">
        <div className="spinner mx-auto"></div>
        <p className="text-warm-600 dark:text-warm-300 mt-4">申請状況を確認中...</p>
      </div>
    );
  }

  if (existingEntry) {
    if (existingEntry.status === 'applied' || existingEntry.status === 'pending_addition') {
      return (
        <div className="w-full max-w-md card p-8 animate-fade-in mt-8 text-center">
          <h1 className="text-2xl font-bold text-primary-800 dark:text-warm-100 mb-4">申請中です</h1>
          <p className="text-warm-600 dark:text-warm-300 mb-6">
            管理者からの連絡をお待ちください。
            <br />
            現在のステータス: <span className="font-semibold text-accent-500">{statusMap[existingEntry.status] || existingEntry.status}</span>
          </p>
          <button onClick={() => router.push('/')} className="btn-accent w-full py-3">
            トップページに戻る
          </button>
        </div>
      );
    }

    if (existingEntry.status === 'contracted') {
      const contracted = existingEntry.contracted_subjects || [];
      const availableSubjects = subjects.filter(
        (subject) => !contracted.includes(subject.id)
      );
      const contractedSubjectNames = contracted.map(id => subjects.find(s => s.id === id)?.name || id);

      return (
        <div className="w-full max-w-md card p-8 animate-fade-in mt-8">
          <h1 className="text-2xl font-bold text-primary-800 dark:text-warm-100 mb-4 text-center">個別講義 追加申請</h1>

          <div className="mb-6 p-4 bg-warm-50 dark:bg-primary-800 rounded-btn">
            <h2 className="text-sm font-semibold text-primary-700 dark:text-warm-300">現在の契約科目</h2>
            {contractedSubjectNames.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {contractedSubjectNames.map(subjectName => (
                  <li key={subjectName} className="text-primary-800 dark:text-warm-100 font-medium">{subjectName}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-warm-500 dark:text-warm-400">現在契約中の科目はありません。</p>
            )}
          </div>

          <form onSubmit={handleAdditionalSubmit} className="space-y-6">
            <div>
              <label htmlFor="additional-subject" className="label">追加希望科目</label>
              <select
                id="additional-subject"
                value={additionalSubject}
                onChange={(e) => setAdditionalSubject(e.target.value)}
                className="input mt-1 block w-full"
                required
              >
                <option value="" disabled>-- 選択してください --</option>
                <option value="undecided">決まっていない</option>
                {availableSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="phone" className="label">電話番号（ハイフンなし）</label>
              <input
                type="tel"
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                className="input mt-1 block w-full"
                placeholder="09012345678"
                maxLength={11}
                required
              />
            </div>
            {error && <p className="text-sm text-danger-500 text-center">{error}</p>}
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-accent w-full py-3 mt-4 disabled:bg-warm-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '申請中...' : '追加申請する'}
              </button>
              {availableSubjects.length === 0 && <p className="text-xs text-center mt-2 text-warm-500 dark:text-warm-400">すべての科目を契約済みです。</p>}
            </div>
          </form>
        </div>
      );
    }
  }

  return (
    <div className="w-full max-w-md card p-8 animate-fade-in mt-8">
      <h1 className="text-2xl font-bold text-primary-800 dark:text-warm-100 mb-2 text-center">個別講義 申請フォーム</h1>
      <p className="text-warm-600 dark:text-warm-300 mb-6 text-center text-sm">個別講義をご希望の場合は、以下のフォームから申請してください。</p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="subject" className="label">希望科目</label>
          <select
            id="subject"
            value={desiredSubject}
            onChange={(e) => setDesiredSubject(e.target.value)}
            className="input mt-1 block w-full"
            required
          >
            <option value="" disabled>-- 選択してください --</option>
            <option value="undecided">決まっていない</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="phone" className="label">電話番号（ハイフンなし）</label>
          <input
            type="tel"
            id="phone"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
            className="input mt-1 block w-full"
            placeholder="09012345678"
            maxLength={11}
            required
          />
        </div>
        {error && <p className="text-sm text-danger-500 text-center">{error}</p>}
        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-accent w-full py-3 mt-4 disabled:bg-warm-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '申請中...' : '申請する'}
          </button>
        </div>
      </form>
    </div>
  );
}
