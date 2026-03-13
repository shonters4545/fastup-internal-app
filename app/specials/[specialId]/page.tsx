'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type SpecialCourse = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  start_date: string;
  end_date: string;
  form_fields: {
    label: string;
    type: 'text' | 'select';
    options?: string[];
  }[];
};

type Entry = {
  id: string;
  status: 'applied' | 'contracted';
};

export default function SpecialEntryPage() {
  const params = useParams();
  const specialId = params.specialId as string;
  const { currentUser } = useAuth();
  const router = useRouter();

  const [special, setSpecial] = useState<SpecialCourse | null>(null);
  const [existingEntry, setExistingEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchSpecialData = async () => {
      if (!specialId) {
        setError('講座IDが見つかりません。');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const supabase = createClient();

        // Fetch special course
        const { data: specialData, error: specialError } = await supabase
          .from('specials')
          .select('*')
          .eq('id', specialId)
          .single();

        if (specialError) throw specialError;

        if (specialData) {
          const course = specialData as SpecialCourse;
          setSpecial(course);

          // Initialize form values
          const initialFormValues: { [key: string]: string } = {};
          if (course.form_fields) {
            course.form_fields.forEach((field: any) => {
              if (field.type === 'select') {
                initialFormValues[field.label] = '';
              }
            });
          }
          setFormValues(initialFormValues);
        } else {
          setError('指定された講座が見つかりませんでした。');
        }

        // Check for existing entry
        if (currentUser) {
          const { data: entriesData, error: entriesError } = await supabase
            .from('entries')
            .select('id, status')
            .eq('user_id', currentUser.id)
            .eq('special_id', specialId);

          if (entriesError) throw entriesError;
          if (entriesData && entriesData.length > 0) {
            setExistingEntry(entriesData[0] as Entry);
          }
        }
      } catch (err) {
        console.error('Error fetching special course data:', err);
        setError('講座の読み込み中にエラーが発生しました。');
      } finally {
        setLoading(false);
      }
    };

    if (currentUser !== undefined) {
      fetchSpecialData();
    }
  }, [specialId, currentUser]);

  const handleInputChange = (label: string, value: string) => {
    setFormValues(prev => ({ ...prev, [label]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !special) {
      setError('申し込みにはログインが必要です。');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();

      // 1. Create Entry
      const { data: entryData, error: entryError } = await (supabase.from('entries') as any).insert({
        user_id: currentUser.id,
        special_id: special.id,
        status: 'applied',
        created_at: new Date().toISOString(),
      }).select('id').single();

      if (entryError) throw entryError;

      // 2. Update entry with form data
      if (Object.keys(formValues).length > 0) {
        const { error: updateError } = await (supabase.from('entries') as any)
          .update({ form_data: formValues })
          .eq('id', entryData.id);
        if (updateError) throw updateError;
      }

      alert('お申し込みが完了しました。');
      router.push('/specials');
    } catch (err) {
      console.error('Error submitting entry:', err);
      setError('申し込み処理中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl text-center p-8 animate-fade-in mt-8">
        <div className="spinner mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-300 mt-4">講座情報を読み込み中...</p>
      </div>
    );
  }

  if (error && !special) {
    return (
      <div className="w-full max-w-lg text-center p-8 bg-danger-100 dark:bg-danger-900/50 rounded-btn animate-fade-in mt-8">
        <h2 className="text-2xl font-bold text-danger-800 dark:text-danger-200">エラー</h2>
        <p className="mt-2 text-danger-600 dark:text-danger-300">{error}</p>
        <Link href="/specials" className="btn-danger mt-6 inline-block">
          講座一覧に戻る
        </Link>
      </div>
    );
  }

  if (!special) return null;

  const isFormDisabled = !!existingEntry || isSubmitting;
  const getStatusText = () => {
    if (!existingEntry) return '';
    return existingEntry.status === 'applied' ? '申込完了' : '契約完了';
  };

  return (
    <div className="w-full max-w-2xl card p-8 animate-fade-in mt-8">
      <div className="mb-8">
        <Link href="/specials" className="text-sm text-primary-600 dark:text-gray-400 hover:underline mb-4 block">
          &larr; 講座一覧に戻る
        </Link>
        <h1 className="text-2xl font-bold text-gray-700 dark:text-gray-100 tracking-wider">{special.title}</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">{special.description}</p>
      </div>

      {existingEntry ? (
        <div className="text-center p-8 bg-success-100 dark:bg-success-900/50 rounded-btn">
          <h2 className="text-2xl font-bold text-success-800 dark:text-success-200">
            この講座には申し込み済みです
          </h2>
          <p className="mt-2 text-success-600 dark:text-success-300">
            現在のステータス: {getStatusText()}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {special.form_fields && special.form_fields.map((field: any, index: number) => (
            <div key={index}>
              <label className="label">{field.label}</label>
              {field.type === 'text' ? (
                <input
                  type="text"
                  value={formValues[field.label] || ''}
                  onChange={e => handleInputChange(field.label, e.target.value)}
                  className="input w-full disabled:bg-gray-200 dark:disabled:bg-gray-800/50"
                  required
                  disabled={isFormDisabled}
                />
              ) : field.type === 'select' && field.options ? (
                <select
                  value={formValues[field.label] || ''}
                  onChange={e => handleInputChange(field.label, e.target.value)}
                  className="input w-full disabled:bg-gray-200 dark:disabled:bg-gray-800/50"
                  required
                  disabled={isFormDisabled}
                >
                  <option value="" disabled>-- 選択してください --</option>
                  {field.options.map((option: string, optIndex: number) => (
                    <option key={optIndex} value={option}>{option}</option>
                  ))}
                </select>
              ) : null}
            </div>
          ))}

          {error && <p className="text-sm text-danger-500 text-center">{error}</p>}

          <div className="pt-4">
            <button
              type="submit"
              className="btn-accent w-full py-3 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={isFormDisabled}
            >
              {isSubmitting ? '送信中...' : '申し込む'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
