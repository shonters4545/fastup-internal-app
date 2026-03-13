'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type FormField = {
  id: number;
  label: string;
  type: 'text' | 'select';
  options: string[];
  required: boolean;
};

export default function AdminEditSurveyPage() {
  const { surveyModelId } = useParams<{ surveyModelId: string }>();
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [formFields, setFormFields] = useState<FormField[]>([
    { id: Date.now(), label: '', type: 'text', options: [], required: true },
  ]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toLocalISOString = (date: Date) => {
    const tzoffset = new Date().getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzoffset).toISOString().slice(0, 16);
  };

  useEffect(() => {
    if (!surveyModelId || authLoading) return;
    const fetchSurveyModel = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await (supabase.from('survey_models') as any)
          .select('*')
          .eq('id', surveyModelId)
          .single();
        if (fetchError || !data) {
          setError('指定されたアンケートが見つかりません。');
          return;
        }
        setTitle(data.title || '');
        if (data.delivery_time) {
          setDeliveryTime(toLocalISOString(new Date(data.delivery_time)));
        }
        if (data.form_fields && data.form_fields.length > 0) {
          setFormFields(
            data.form_fields.map((field: any, index: number) => ({
              ...field,
              id: Date.now() + index,
              options: field.options || [],
              required: field.required !== false,
            }))
          );
        }
      } catch (err) {
        setError('アンケートの読み込みに失敗しました。');
      } finally {
        setLoading(false);
      }
    };
    fetchSurveyModel();
  }, [surveyModelId, authLoading]);

  const handleAddField = () => {
    setFormFields((prev) => [...prev, { id: Date.now(), label: '', type: 'text', options: [], required: true }]);
  };
  const handleRemoveField = (id: number) => {
    setFormFields((prev) => prev.filter((f) => f.id !== id));
  };
  const handleFieldChange = (id: number, field: 'label' | 'type', value: string) => {
    setFormFields((prev) => prev.map((f) => {
      if (f.id !== id) return f;
      const updated = { ...f, [field]: value };
      if (field === 'type' && value === 'text') updated.options = [];
      return updated;
    }));
  };
  const handleFieldRequiredChange = (id: number, isRequired: boolean) => {
    setFormFields((prev) => prev.map((f) => (f.id === id ? { ...f, required: isRequired } : f)));
  };
  const handleAddOption = (fieldId: number) => {
    setFormFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, options: [...f.options, ''] } : f)));
  };
  const handleOptionChange = (fieldId: number, optionIndex: number, value: string) => {
    setFormFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, options: f.options.map((opt, idx) => (idx === optionIndex ? value : opt)) } : f)));
  };
  const handleRemoveOption = (fieldId: number, optionIndex: number) => {
    setFormFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, options: f.options.filter((_, idx) => idx !== optionIndex) } : f)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const finalFormFields = formFields.map(({ id, ...field }) => {
        if (!field.label.trim()) throw new Error('すべての項目にラベルを入力してください。');
        const processed: { label: string; type: string; required: boolean; options?: string[] } = {
          label: field.label.trim(),
          type: field.type,
          required: field.required,
        };
        if (field.type === 'select') {
          const options = field.options.map((o) => o.trim()).filter(Boolean);
          if (options.length === 0) throw new Error(`「${field.label}」の選択肢を1つ以上入力してください。`);
          processed.options = options;
        }
        return processed;
      });
      if (!title) throw new Error('アンケートタイトルを入力してください。');
      if (!deliveryTime) throw new Error('配信日時を設定してください。');

      setIsSubmitting(true);
      const supabase = createClient();
      const { error: updateError } = await (supabase.from('survey_models') as any)
        .update({
          title,
          form_fields: finalFormFields,
          delivery_time: new Date(deliveryTime).toISOString(),
          delivery_status: 'scheduled',
        })
        .eq('id', surveyModelId);
      if (updateError) throw updateError;
      router.push('/admin/surveys');
    } catch (err: any) {
      setError(err.message || '保存中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return <div className="text-center p-8"><div className="spinner mx-auto"></div></div>;
  }

  if (!authLoading && currentUser && !['admin', 'super'].includes(currentUser.role)) {
    router.push('/');
    return null;
  }

  return (
    <div className="w-full max-w-4xl card p-8 animate-fade-in mt-8">
      <div className="flex justify-between items-center mb-6 border-b dark:border-primary-800 pb-4">
        <h1 className="text-3xl font-bold text-primary-800 dark:text-warm-100">アンケート編集</h1>
        <Link href="/admin/surveys" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">&larr; 一覧に戻る</Link>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="survey-title" className="label">アンケートタイトル</label>
          <input type="text" id="survey-title" value={title} onChange={(e) => setTitle(e.target.value)} className="input mt-1" required />
        </div>
        <div>
          <label htmlFor="delivery-time" className="label">配信日時</label>
          <input type="datetime-local" id="delivery-time" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className="input mt-1" required />
        </div>
        <div>
          <label className="label">質問項目</label>
          <div className="mt-2 space-y-3 p-3 border border-warm-200 dark:border-primary-700 rounded-input bg-warm-50 dark:bg-primary-950/50">
            {formFields.map((field) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-start p-2 bg-white dark:bg-primary-900 rounded-input shadow-sm">
                <div className="col-span-12 sm:col-span-4">
                  <input type="text" placeholder="質問文" value={field.label} onChange={(e) => handleFieldChange(field.id, 'label', e.target.value)} className="w-full p-2 border border-warm-300 dark:border-primary-700 rounded-input text-sm text-primary-800 dark:text-warm-100 bg-white dark:bg-primary-800" required />
                </div>
                <div className="col-span-12 sm:col-span-2">
                  <select value={field.type} onChange={(e) => handleFieldChange(field.id, 'type', e.target.value)} className="w-full p-2 border border-warm-300 dark:border-primary-700 rounded-input text-sm text-primary-800 dark:text-warm-100 bg-white dark:bg-primary-800">
                    <option value="text">テキスト</option>
                    <option value="select">セレクト</option>
                  </select>
                </div>
                <div className="col-span-12 sm:col-span-2 flex items-center h-full pl-2">
                  <input type="checkbox" checked={field.required} onChange={(e) => handleFieldRequiredChange(field.id, e.target.checked)} id={`required-${field.id}`} className="h-4 w-4 rounded border-warm-300 text-primary-600 focus:ring-primary-500" />
                  <label htmlFor={`required-${field.id}`} className="ml-2 text-xs text-warm-600 dark:text-warm-300">必須</label>
                </div>
                <div className="col-span-12 sm:col-span-3">
                  {field.type === 'select' && (
                    <div className="space-y-2">
                      {field.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <input type="text" placeholder={`選択肢 ${optionIndex + 1}`} value={option} onChange={(e) => handleOptionChange(field.id, optionIndex, e.target.value)} className="w-full p-2 border border-warm-300 dark:border-primary-700 rounded-input text-sm text-primary-800 dark:text-warm-100 bg-white dark:bg-primary-800" />
                          <button type="button" onClick={() => handleRemoveOption(field.id, optionIndex)} className="text-danger-500 hover:text-danger-700 p-1 rounded-full disabled:opacity-50" disabled={field.options.length <= 1}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => handleAddOption(field.id)} className="text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-semibold">+ 選択肢を追加</button>
                    </div>
                  )}
                </div>
                <div className="col-span-12 sm:col-span-1 text-right self-center">
                  <button type="button" onClick={() => handleRemoveField(field.id)} className="text-danger-500 hover:text-danger-700 p-1 rounded-full disabled:opacity-50" disabled={formFields.length <= 1}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={handleAddField} className="mt-2 text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-semibold">+ 項目を追加する</button>
          </div>
        </div>
        {error && <p className="text-sm text-danger-500 text-center">{error}</p>}
        <div className="flex justify-end gap-2 pt-4">
          <button type="submit" disabled={isSubmitting} className="btn-primary disabled:opacity-50">
            {isSubmitting ? '保存中...' : '保存する'}
          </button>
        </div>
      </form>
    </div>
  );
}
