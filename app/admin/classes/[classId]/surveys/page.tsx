'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type ClassInfo = { title: string; start_time: string };
type SurveyField = {
  label: string;
  type: 'text' | 'select';
  options?: string[];
  analysisKey?: string;
  scoreMap?: { [key: string]: number };
};
type SurveyModel = { title: string; form_fields: SurveyField[] };
type DisplayResponse = {
  userId: string;
  nickname: string;
  instructorName: string;
  subjectName: string;
  bookName: string;
  taskName: string;
  responses: { [key: string]: string | string[] };
  hasSubmitted: boolean;
};
type AnalysisResults = {
  overallAvg: number | null;
  coachAvgs: { name: string; avg: number; count: number }[];
  totalSubmitted: number;
  totalAttendees: number;
};

export default function AdminClassSurveysPage() {
  const { classId } = useParams<{ classId: string }>();
  const { loading: authLoading } = useAuth();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [surveyModel, setSurveyModel] = useState<SurveyModel | null>(null);
  const [responses, setResponses] = useState<DisplayResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLowScoreOnly, setShowLowScoreOnly] = useState(false);
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    if (!classId) { setError('特訓IDが見つかりません。'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Fetch class and attendance
      const [classRes, attendanceRes] = await Promise.all([
        (supabase.from('classes') as any).select('title, start_time').eq('id', classId).single(),
        (supabase.from('attendance_records') as any).select('user_id, instructor_name, subject_id, book_id, task_id').eq('class_id', classId),
      ]);
      if (classRes.error) throw new Error('特訓情報が見つかりません。');
      setClassInfo(classRes.data);

      const attendees: { userId: string; instructorName: string; subjectId: string | null; bookId: string | null; taskId: string | null }[] = (attendanceRes.data || []).map((a: any) => ({
        userId: a.user_id,
        instructorName: a.instructor_name || '未設定',
        subjectId: a.subject_id || null,
        bookId: a.book_id || null,
        taskId: a.task_id || null,
      }));

      if (attendees.length === 0) { setResponses([]); setLoading(false); return; }

      // Fetch subject / book / task names
      const subjectIds = [...new Set(attendees.map((a) => a.subjectId).filter((v): v is string => !!v))];
      const bookIds = [...new Set(attendees.map((a) => a.bookId).filter((v): v is string => !!v))];
      const taskIds = [...new Set(attendees.map((a) => a.taskId).filter((v): v is string => !!v))];
      const [subjectsRes, booksRes, tasksRes] = await Promise.all([
        subjectIds.length > 0 ? (supabase.from('subjects') as any).select('id, name').in('id', subjectIds) : Promise.resolve({ data: [] }),
        bookIds.length > 0 ? (supabase.from('books') as any).select('id, name').in('id', bookIds) : Promise.resolve({ data: [] }),
        taskIds.length > 0 ? (supabase.from('tasks') as any).select('id, name').in('id', taskIds) : Promise.resolve({ data: [] }),
      ]);
      const subjectsMap = new Map<string, string>((subjectsRes.data || []).map((s: any) => [s.id, s.name]));
      const booksMap = new Map<string, string>((booksRes.data || []).map((b: any) => [b.id, b.name]));
      const tasksMap = new Map<string, string>((tasksRes.data || []).map((t: any) => [t.id, t.name]));

      // Fetch survey responses for this class
      const { data: responsesData } = await (supabase.from('survey_responses') as any)
        .select('user_id, responses, survey_model_id')
        .eq('class_id', classId);

      const responseMap = new Map<string, any>();
      let surveyModelId: string | null = null;
      (responsesData || []).forEach((r: any) => {
        responseMap.set(r.user_id, r);
        if (!surveyModelId) surveyModelId = r.survey_model_id;
      });

      // Fetch survey model
      let modelQuery = (supabase.from('survey_models') as any).select('title, form_fields');
      if (surveyModelId) {
        modelQuery = modelQuery.eq('id', surveyModelId);
      } else {
        modelQuery = modelQuery.eq('type', 'class_feedback');
      }
      const { data: modelData, error: modelError } = await modelQuery.limit(1).single();
      if (modelError || !modelData) throw new Error('アンケートの型が見つかりません。');
      setSurveyModel(modelData);

      // Fetch user nicknames
      const userIds = [...new Set(attendees.map((a) => a.userId))];
      const { data: usersData } = await (supabase.from('users') as any)
        .select('id, nickname, display_name')
        .in('id', userIds);
      const usersMap = new Map<string, string>((usersData || []).map((u: any) => [u.id, u.nickname || u.display_name || '（名前未設定）']));

      // Build display list
      const displayResponses: DisplayResponse[] = attendees.map((attendee) => {
        const actual = responseMap.get(attendee.userId);
        return {
          userId: attendee.userId,
          nickname: usersMap.get(attendee.userId) || '（不明な生徒）',
          instructorName: attendee.instructorName,
          subjectName: (attendee.subjectId && subjectsMap.get(attendee.subjectId)) || '-',
          bookName: (attendee.bookId && booksMap.get(attendee.bookId)) || '-',
          taskName: (attendee.taskId && tasksMap.get(attendee.taskId)) || '-',
          responses: actual ? (actual.responses || {}) : {},
          hasSubmitted: !!actual,
        };
      });
      displayResponses.sort((a, b) => {
        if (a.hasSubmitted === b.hasSubmitted) return a.nickname.localeCompare(b.nickname);
        return a.hasSubmitted ? -1 : 1;
      });
      setResponses(displayResponses);
    } catch (err) {
      console.error('Error fetching survey results:', err);
      setError(err instanceof Error ? err.message : 'データ取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { if (!authLoading) fetchData(); }, [authLoading, fetchData]);

  const availableCoaches = useMemo(() => {
    const set = new Set<string>();
    responses.forEach((r) => { if (r.instructorName) set.add(r.instructorName); });
    return Array.from(set).sort();
  }, [responses]);

  const filteredResponses = useMemo(() => {
    let result = responses;
    if (selectedCoaches.length > 0) result = result.filter((r) => selectedCoaches.includes(r.instructorName));
    if (showLowScoreOnly && surveyModel) {
      const masterField = surveyModel.form_fields.find((f) => f.analysisKey === 'master_score');
      if (masterField?.scoreMap) {
        const scoreLabel = masterField.label;
        const scoreMap = masterField.scoreMap;
        result = result.filter((r) => {
          if (!r.hasSubmitted) return false;
          const answer = r.responses[scoreLabel];
          if (typeof answer !== 'string') return false;
          const score = scoreMap[answer];
          return score !== undefined && score <= 8;
        });
      }
    }
    return result;
  }, [responses, showLowScoreOnly, surveyModel, selectedCoaches]);

  const analysis = useMemo((): AnalysisResults => {
    const totalAttendees = responses.length;
    const submitted = responses.filter((r) => r.hasSubmitted);
    if (!surveyModel || submitted.length === 0) return { overallAvg: null, coachAvgs: [], totalSubmitted: 0, totalAttendees };
    const masterField = surveyModel.form_fields.find((f) => f.analysisKey === 'master_score');
    if (!masterField?.scoreMap) return { overallAvg: null, coachAvgs: [], totalSubmitted: submitted.length, totalAttendees };
    const scoreLabel = masterField.label;
    const scoreMap = masterField.scoreMap;
    let globalTotal = 0, globalCount = 0;
    const coachScores = new Map<string, { total: number; count: number }>();
    submitted.forEach((res) => {
      const answer = res.responses[scoreLabel];
      if (typeof answer === 'string' && scoreMap[answer] !== undefined) {
        const score = scoreMap[answer];
        globalTotal += score; globalCount++;
        const cur = coachScores.get(res.instructorName) || { total: 0, count: 0 };
        coachScores.set(res.instructorName, { total: cur.total + score, count: cur.count + 1 });
      }
    });
    const coachAvgs = Array.from(coachScores.entries()).map(([name, d]) => ({
      name, avg: Math.round((d.total / d.count) * 10) / 10, count: d.count,
    })).sort((a, b) => b.avg - a.avg);
    return { overallAvg: globalCount > 0 ? Math.round((globalTotal / globalCount) * 10) / 10 : null, coachAvgs, totalSubmitted: submitted.length, totalAttendees };
  }, [surveyModel, responses]);

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-4xl text-center p-8 animate-fade-in mt-8">
        <div className="spinner mx-auto"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-lg text-center p-8 bg-danger-100 dark:bg-danger-900/50 rounded-card animate-fade-in mt-8">
        <h2 className="text-2xl font-bold text-danger-800 dark:text-danger-200">エラー</h2>
        <p className="mt-2 text-danger-600 dark:text-danger-300">{error}</p>
        <Link href="/admin/classes" className="mt-6 inline-block btn-danger">特訓管理に戻る</Link>
      </div>
    );
  }

  const questionLabels = surveyModel?.form_fields.map((f) => f.label) || [];

  return (
    <div className="w-full max-w-7xl card animate-fade-in mt-8 mx-auto">
      <div className="flex justify-between items-start mb-6 border-b dark:border-gray-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">アンケート結果分析</h1>
          {classInfo && <p className="text-gray-500 dark:text-gray-400 mt-1">{classInfo.title} ({new Date(classInfo.start_time).toLocaleDateString('ja-JP')})</p>}
        </div>
        <Link href="/admin/classes" className="text-sm text-primary-600 dark:text-gray-400 hover:underline flex-shrink-0 mt-1">&larr; 特訓管理に戻る</Link>
      </div>

      {/* Analysis Dashboard */}
      {(analysis.overallAvg || analysis.coachAvgs.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-primary-600 rounded-card shadow-card p-6 text-white flex flex-col justify-center items-center">
            <div className="text-primary-100 text-sm font-bold uppercase tracking-wider mb-2">全体満足度平均</div>
            <div className="flex items-baseline">
              <span className="text-5xl font-black">{analysis.overallAvg || '-'}</span>
              <span className="text-xl ml-1 opacity-80">/ 10</span>
            </div>
          </div>
          <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-card shadow-card p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">コーチ別満足度平均</h3>
            <div className="space-y-3 max-h-[120px] overflow-y-auto pr-2">
              {analysis.coachAvgs.length > 0 ? analysis.coachAvgs.map((coach, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 p-3 rounded-btn border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-gray-900/40 text-primary-600 dark:text-gray-300 rounded-full flex items-center justify-center text-xs font-black">{idx + 1}</div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{coach.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400">回答: {coach.count}件</span>
                    <span className="text-lg font-black text-primary-600 dark:text-gray-400">{coach.avg}<span className="text-[10px] text-gray-400 ml-0.5">pt</span></span>
                  </div>
                </div>
              )) : <p className="text-center text-gray-500 py-4">回答データがありません</p>}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col mb-8 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-card border border-gray-100 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">表示条件で絞り込む</h2>
        <div className="space-y-6">
          <div>
            <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">満足度スコア</span>
            <label className="inline-flex items-center cursor-pointer bg-white dark:bg-gray-900 px-4 py-2 rounded-btn border border-gray-200 dark:border-gray-700 shadow-sm">
              <input type="checkbox" checked={showLowScoreOnly} onChange={(e) => setShowLowScoreOnly(e.target.checked)} className="w-5 h-5 text-danger-600 border-gray-300 rounded-input focus:ring-danger-500" />
              <span className="ml-3 text-sm font-bold text-gray-700 dark:text-gray-200">満足度8点以下の生徒のみ表示</span>
            </label>
          </div>
          {availableCoaches.length > 0 && (
            <div>
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">担当コーチ (複数選択可)</span>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSelectedCoaches([])} className={`px-4 py-2 rounded-btn text-sm font-bold border transition-all ${selectedCoaches.length === 0 ? 'bg-primary-600 border-primary-600 text-white shadow-md' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>全員表示</button>
                {availableCoaches.map((coach) => {
                  const isSelected = selectedCoaches.includes(coach);
                  return (
                    <button key={coach} onClick={() => setSelectedCoaches((prev) => isSelected ? prev.filter((n) => n !== coach) : [...prev, coach])} className={`px-4 py-2 rounded-btn text-sm font-bold border transition-all ${isSelected ? 'bg-primary-600 border-primary-600 text-white shadow-md' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                      {coach}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">出席者・回答詳細</h2>
        <div className="flex items-center gap-4">
          {(selectedCoaches.length > 0 || showLowScoreOnly) && (
            <span className="text-xs font-bold text-primary-600 bg-primary-50 dark:bg-gray-900/30 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-800">絞り込み中: {filteredResponses.length}名を表示</span>
          )}
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            回収率: {analysis.totalSubmitted} / {analysis.totalAttendees}名 ({analysis.totalAttendees > 0 ? Math.round((analysis.totalSubmitted / analysis.totalAttendees) * 100) : 0}%)
          </span>
        </div>
      </div>

      {!surveyModel || responses.length === 0 ? (
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-card">
          <p className="text-gray-600 dark:text-gray-400">この特訓に対する出席記録がありません。</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-card">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">回答者</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">担当コーチ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">科目</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">使用教材</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ユニット</th>
                {questionLabels.map((label) => (
                  <th key={label} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider min-w-[250px]">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredResponses.length === 0 ? (
                <tr><td colSpan={questionLabels.length + 5} className="px-6 py-10 text-center text-gray-500 italic">条件に一致する生徒はいません</td></tr>
              ) : filteredResponses.map((response, index) => (
                <tr key={index} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${!response.hasSubmitted ? 'opacity-70 bg-gray-50/30' : ''}`}>
                  <td className="sticky left-0 z-10 bg-inherit px-6 py-4 whitespace-nowrap font-bold border-r dark:border-gray-700">
                    <Link href={`/admin/student/${response.userId}`} className="text-sm text-primary-600 dark:text-gray-400 hover:underline">{response.nickname}</Link>
                    {!response.hasSubmitted && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-badge text-xs font-medium bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400">未回答</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{response.instructorName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{response.subjectName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300"><div className="max-w-xs whitespace-pre-wrap">{response.bookName}</div></td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300"><div className="max-w-xs whitespace-pre-wrap">{response.taskName}</div></td>
                  {questionLabels.map((label) => {
                    const answer = response.responses[label];
                    if (!response.hasSubmitted || answer === undefined) {
                      return <td key={`${response.userId}-${label}`} className="px-6 py-4 text-sm text-gray-400 italic">未回答</td>;
                    }
                    return (
                      <td key={`${response.userId}-${label}`} className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        <div className="max-w-sm whitespace-pre-wrap">{typeof answer === 'string' ? answer : (answer as string[]).join(', ')}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
