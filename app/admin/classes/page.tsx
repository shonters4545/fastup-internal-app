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

type SurveyFormField = {
  id: number;
  label: string;
  type: 'text' | 'select';
  options: string[];
  required: boolean;
  isMasterScore?: boolean;
  optionScores?: number[];
};

// --- SurveyManagementModal ---
function SurveyManagementModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [formFields, setFormFields] = useState<SurveyFormField[]>([
    { id: Date.now(), label: '', type: 'text', options: [], required: true, isMasterScore: false, optionScores: [] },
  ]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [modelId, setModelId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSurveyModel = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error: fetchErr } = await (supabase.from('survey_models') as any)
          .select('*')
          .eq('type', 'class_feedback')
          .limit(1)
          .single();

        if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;

        if (data) {
          setModelId(data.id);
          setTitle(data.title || '特訓アンケート');
          const fields = data.form_fields;
          if (Array.isArray(fields) && fields.length > 0) {
            setFormFields(
              fields.map((field: any, index: number) => {
                const isMaster = field.analysisKey === 'master_score';
                const options = field.options || [];
                const scores = options.map((opt: string) => field.scoreMap?.[opt] ?? 0);
                return {
                  id: Date.now() + index,
                  label: field.label || '',
                  type: field.type || 'text',
                  options,
                  required: field.required !== false,
                  isMasterScore: isMaster,
                  optionScores: scores,
                };
              })
            );
          }
        } else {
          setTitle('特訓アンケート');
        }
      } catch (err) {
        console.error('Error fetching survey model:', err);
        setError('アンケートの型の読み込みに失敗しました。');
      } finally {
        setLoading(false);
      }
    };
    fetchSurveyModel();
  }, []);

  const handleAddField = () => {
    setFormFields((prev) => [
      ...prev,
      { id: Date.now(), label: '', type: 'text', options: [], required: true, isMasterScore: false, optionScores: [] },
    ]);
  };
  const handleRemoveField = (id: number) => {
    setFormFields((prev) => prev.filter((f) => f.id !== id));
  };
  const handleFieldChange = (id: number, key: 'label' | 'type', value: string) => {
    setFormFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [key]: value } : f))
    );
  };
  const handleFieldRequiredChange = (id: number, isRequired: boolean) => {
    setFormFields((prev) => prev.map((f) => (f.id === id ? { ...f, required: isRequired } : f)));
  };
  const handleFieldMasterScoreChange = (id: number, isMaster: boolean) => {
    setFormFields((prev) =>
      prev.map((f) => ({ ...f, isMasterScore: f.id === id ? isMaster : false }))
    );
  };
  const handleAddOption = (fieldId: number) => {
    setFormFields((prev) =>
      prev.map((f) =>
        f.id === fieldId
          ? { ...f, options: [...f.options, ''], optionScores: [...(f.optionScores || []), 0] }
          : f
      )
    );
  };
  const handleOptionChange = (fieldId: number, optionIndex: number, value: string) => {
    setFormFields((prev) =>
      prev.map((f) =>
        f.id === fieldId
          ? { ...f, options: f.options.map((opt, idx) => (idx === optionIndex ? value : opt)) }
          : f
      )
    );
  };
  const handleScoreChange = (fieldId: number, optionIndex: number, value: number) => {
    setFormFields((prev) =>
      prev.map((f) =>
        f.id === fieldId
          ? {
              ...f,
              optionScores: (f.optionScores || f.options.map(() => 0)).map((score, idx) =>
                idx === optionIndex ? value : score
              ),
            }
          : f
      )
    );
  };
  const handleRemoveOption = (fieldId: number, optionIndex: number) => {
    setFormFields((prev) =>
      prev.map((f) =>
        f.id === fieldId
          ? {
              ...f,
              options: f.options.filter((_, idx) => idx !== optionIndex),
              optionScores: (f.optionScores || []).filter((_, idx) => idx !== optionIndex),
            }
          : f
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (!title.trim()) throw new Error('アンケートタイトルを入力してください。');

      const finalFormFields = formFields.map(({ id, isMasterScore, optionScores, ...field }) => {
        if (!field.label.trim()) throw new Error('すべての項目にラベルを入力してください。');

        const processedField: any = {
          label: field.label.trim(),
          type: field.type,
          required: field.required,
        };

        if (field.type === 'select') {
          const options = field.options.map((opt) => opt.trim()).filter(Boolean);
          if (options.length === 0)
            throw new Error(`「${field.label}」の選択肢を1つ以上入力してください。`);
          processedField.options = options;

          if (isMasterScore) {
            processedField.analysisKey = 'master_score';
            const scoreMap: { [key: string]: number } = {};
            options.forEach((opt, idx) => {
              scoreMap[opt] = optionScores?.[idx] ?? 0;
            });
            processedField.scoreMap = scoreMap;
          }
        }
        return processedField;
      });

      setIsSubmitting(true);
      const supabase = createClient();
      const dataToSave = {
        title: title.trim(),
        form_fields: finalFormFields,
        type: 'class_feedback',
      };

      if (modelId) {
        const { error: updateErr } = await (supabase.from('survey_models') as any)
          .update(dataToSave)
          .eq('id', modelId);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await (supabase.from('survey_models') as any).insert(dataToSave);
        if (insertErr) throw insertErr;
      }

      alert('アンケート設定を保存しました。');
      onClose();
    } catch (err: any) {
      console.error('Error saving survey model:', err);
      setError(err.message || '保存中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-5xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">アンケート管理</h3>
          <div className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full font-bold">
            セレクト形式で「満足度集計」にチェック → 満足度計算に使用
          </div>
        </div>
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">読み込み中...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 flex-grow overflow-y-auto pr-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                アンケートタイトル
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">質問項目</label>
              <div className="mt-2 space-y-3 p-3 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900/50">
                {formFields.map((field) => (
                  <div
                    key={field.id}
                    className={`grid grid-cols-12 gap-2 items-start p-3 rounded-md shadow-sm transition-all bg-white dark:bg-gray-800 ${
                      field.isMasterScore
                        ? 'ring-2 ring-emerald-400 border-l-4 border-emerald-400'
                        : 'border-l-4 border-transparent'
                    }`}
                  >
                    <div className="col-span-12 sm:col-span-3">
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">質問文</label>
                      <input
                        type="text"
                        placeholder="質問文"
                        value={field.label}
                        onChange={(e) => handleFieldChange(field.id, 'label', e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white"
                        required
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-2">
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">回答形式</label>
                      <select
                        value={field.type}
                        onChange={(e) => handleFieldChange(field.id, 'type', e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white"
                      >
                        <option value="text">テキスト</option>
                        <option value="select">セレクト</option>
                      </select>
                    </div>
                    <div className="col-span-12 sm:col-span-2 flex flex-col justify-center h-full pt-4">
                      <div className="flex items-center mb-1">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => handleFieldRequiredChange(field.id, e.target.checked)}
                          id={`required-${field.id}`}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor={`required-${field.id}`} className="ml-2 text-xs text-gray-600 dark:text-gray-300">
                          必須
                        </label>
                      </div>
                      {field.type === 'select' && (
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={field.isMasterScore || false}
                            onChange={(e) => handleFieldMasterScoreChange(field.id, e.target.checked)}
                            id={`master-${field.id}`}
                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <label
                            htmlFor={`master-${field.id}`}
                            className="ml-2 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                          >
                            満足度集計
                          </label>
                        </div>
                      )}
                    </div>
                    <div className="col-span-12 sm:col-span-4">
                      {field.type === 'select' && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 block mb-1 flex justify-between">
                            <span>選択肢</span>
                            {field.isMasterScore && <span>配点 (0-10)</span>}
                          </label>
                          {field.options.map((option, optionIndex) => (
                            <div key={optionIndex} className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder={`選択肢 ${optionIndex + 1}`}
                                value={option}
                                onChange={(e) => handleOptionChange(field.id, optionIndex, e.target.value)}
                                className="flex-grow p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white"
                              />
                              {field.isMasterScore && (
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  value={field.optionScores?.[optionIndex] ?? 0}
                                  onChange={(e) =>
                                    handleScoreChange(field.id, optionIndex, parseInt(e.target.value) || 0)
                                  }
                                  className="w-16 p-2 border border-emerald-300 dark:border-emerald-700 rounded-md text-sm text-center font-bold bg-emerald-50 dark:bg-emerald-900/20 text-gray-900 dark:text-white"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(field.id, optionIndex)}
                                className="text-red-500 hover:text-red-700 p-1 rounded-full disabled:opacity-50"
                                title="この選択肢を削除"
                                disabled={field.options.length <= 1}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleAddOption(field.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold"
                          >
                            + 選択肢を追加
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="col-span-12 sm:col-span-1 text-right self-center pt-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveField(field.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded-full disabled:opacity-50"
                        title="この項目を削除"
                        disabled={formFields.length <= 1}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddField}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold"
                >
                  + 項目を追加する
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-white dark:bg-gray-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-500 rounded-md text-sm text-gray-800 dark:text-white"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:bg-gray-400 font-bold"
              >
                {isSubmitting ? '保存中...' : '保存する'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

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
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
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
        (supabase.from('survey_responses') as any).select('class_id').eq('type', 'class_feedback'),
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSurveyModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors"
            >
              アンケート管理
            </button>
            <button onClick={() => setIsModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors">
              新規特訓を開講する
            </button>
          </div>
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
                        詳細を見る
                      </Link>
                      {currentUser?.role === 'super' && (
                        <button
                          onClick={async () => {
                            if (!window.confirm(`「${cls.title}」を削除しますか？関連する出席記録・アンケート回答も削除されます。`)) return;
                            try {
                              const supabase = createClient();
                              const { error: delErr } = await (supabase.from('classes') as any).delete().eq('id', cls.id);
                              if (delErr) throw delErr;
                              fetchData();
                            } catch (err) {
                              console.error('Error deleting class:', err);
                              alert('削除に失敗しました。');
                            }
                          }}
                          className="px-3 py-2 text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                        >
                          削除
                        </button>
                      )}
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

      {isSurveyModalOpen && (
        <SurveyManagementModal onClose={() => setIsSurveyModalOpen(false)} />
      )}
    </>
  );
}
