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
        (supabase.from('attendance_records') as any).select('user_id, instructor_name').eq('class_id', classId),
      ]);
      if (classRes.error) throw new Error('特訓情報が見つかりません。');
      setClassInfo(classRes.data);

      const attendees: { userId: string; instructorName: string }[] = (attendanceRes.data || []).map((a: any) => ({
        userId: a.user_id,
        instructorName: a.instructor_name || '未設定',
      }));

      if (attendees.length === 0) { setResponses([]); setLoading(false); return; }

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
        modelQuery = modelQuery.eq('type', 'practice');
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
        <div className="w-12 h-12 border-4 border-purple-500 border-dashed rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-lg text-center p-8 bg-red-100 dark:bg-red-900/50 rounded-lg animate-fade-in mt-8">
        <h2 className="text-2xl font-bold text-red-800 dark:text-red-200">エラー</h2>
        <p className="mt-2 text-red-600 dark:text-red-300">{error}</p>
        <Link href="/admin/classes" className="mt-6 inline-block bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg">特訓管理に戻る</Link>
      </div>
    );
  }

  const questionLabels = surveyModel?.form_fields.map((f) => f.label) || [];

  return (
    <div className="w-full max-w-7xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 animate-fade-in mt-8 mx-auto">
      <div className="flex justify-between items-start mb-6 border-b dark:border-gray-700 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">アンケート結果分析</h1>
          {classInfo && <p className="text-gray-500 dark:text-gray-400 mt-1">{classInfo.title} ({new Date(classInfo.start_time).toLocaleDateString('ja-JP')})</p>}
        </div>
        <Link href="/admin/classes" className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0 mt-1">&larr; 特訓管理に戻る</Link>
      </div>

      {/* Analysis Dashboard */}
      {(analysis.overallAvg || analysis.coachAvgs.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-indigo-600 rounded-2xl shadow-lg p-6 text-white flex flex-col justify-center items-center">
            <div className="text-indigo-100 text-sm font-bold uppercase tracking-wider mb-2">全体満足度平均</div>
            <div className="flex items-baseline">
              <span className="text-5xl font-black">{analysis.overallAvg || '-'}</span>
              <span className="text-xl ml-1 opacity-80">/ 10</span>
            </div>
          </div>
          <div className="md:col-span-2 bg-white dark:bg-gray-700 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-600">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">コーチ別満足度平均</h3>
            <div className="space-y-3 max-h-[120px] overflow-y-auto pr-2">
              {analysis.coachAvgs.length > 0 ? analysis.coachAvgs.map((coach, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded-full flex items-center justify-center text-xs font-black">{idx + 1}</div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{coach.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400">回答: {coach.count}件</span>
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{coach.avg}<span className="text-[10px] text-gray-400 ml-0.5">pt</span></span>
                  </div>
                </div>
              )) : <p className="text-center text-gray-500 py-4">回答データがありません</p>}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col mb-8 p-6 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-600">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">表示条件で絞り込む</h2>
        <div className="space-y-6">
          <div>
            <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">満足度スコア</span>
            <label className="inline-flex items-center cursor-pointer bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm">
              <input type="checkbox" checked={showLowScoreOnly} onChange={(e) => setShowLowScoreOnly(e.target.checked)} className="w-5 h-5 text-red-600 border-gray-300 rounded-lg focus:ring-red-500" />
              <span className="ml-3 text-sm font-bold text-gray-700 dark:text-gray-200">満足度8点以下の生徒のみ表示</span>
            </label>
          </div>
          {availableCoaches.length > 0 && (
            <div>
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">担当コーチ (複数選択可)</span>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSelectedCoaches([])} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${selectedCoaches.length === 0 ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>全員表示</button>
                {availableCoaches.map((coach) => {
                  const isSelected = selectedCoaches.includes(coach);
                  return (
                    <button key={coach} onClick={() => setSelectedCoaches((prev) => isSelected ? prev.filter((n) => n !== coach) : [...prev, coach])} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>
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
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">出席者・回答詳細</h2>
        <div className="flex items-center gap-4">
          {(selectedCoaches.length > 0 || showLowScoreOnly) && (
            <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-800">絞り込み中: {filteredResponses.length}名を表示</span>
          )}
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            回収率: {analysis.totalSubmitted} / {analysis.totalAttendees}名 ({analysis.totalAttendees > 0 ? Math.round((analysis.totalSubmitted / analysis.totalAttendees) * 100) : 0}%)
          </span>
        </div>
      </div>

      {!surveyModel || responses.length === 0 ? (
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-gray-600 dark:text-gray-400">この特訓に対する出席記録がありません。</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">回答者</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">担当コーチ</th>
                {questionLabels.map((label) => (
                  <th key={label} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider min-w-[250px]">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredResponses.length === 0 ? (
                <tr><td colSpan={questionLabels.length + 2} className="px-6 py-10 text-center text-gray-500 italic">条件に一致する生徒はいません</td></tr>
              ) : filteredResponses.map((response, index) => (
                <tr key={index} className={`hover:bg-gray-50 dark:hover:bg-gray-900/50 ${!response.hasSubmitted ? 'opacity-70 bg-gray-50/30' : ''}`}>
                  <td className="sticky left-0 z-10 bg-inherit px-6 py-4 whitespace-nowrap font-bold border-r dark:border-gray-700">
                    <Link href={`/admin/student/${response.userId}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{response.nickname}</Link>
                    {!response.hasSubmitted && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">未回答</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{response.instructorName}</td>
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
