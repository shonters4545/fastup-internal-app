'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type SurveyModel = { title: string; form_fields: { label: string; type: 'text' | 'select'; options?: string[] }[] };
type DisplayResponse = {
  userId: string;
  nickname: string;
  responses: { [key: string]: string | string[] };
};

export default function AdminGeneralSurveyResultsPage() {
  const { surveyModelId } = useParams<{ surveyModelId: string }>();
  const { loading: authLoading } = useAuth();
  const [surveyModel, setSurveyModel] = useState<SurveyModel | null>(null);
  const [responses, setResponses] = useState<DisplayResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!surveyModelId) { setError('アンケートIDが見つかりません。'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Fetch survey model
      const { data: modelData, error: modelError } = await (supabase.from('survey_models') as any)
        .select('title, form_fields')
        .eq('id', surveyModelId)
        .single();
      if (modelError || !modelData) throw new Error('アンケートの型が見つかりません。');
      setSurveyModel(modelData);

      // Fetch responses
      const { data: responsesData } = await (supabase.from('survey_responses') as any)
        .select('user_id, responses')
        .eq('survey_model_id', surveyModelId);

      if (!responsesData || responsesData.length === 0) {
        setResponses([]);
        setLoading(false);
        return;
      }

      // Get user nicknames
      const userIds = [...new Set(responsesData.map((r: any) => r.user_id))];
      const { data: usersData } = await (supabase.from('users') as any)
        .select('id, nickname, display_name')
        .in('id', userIds);
      const usersMap = new Map((usersData || []).map((u: any) => [u.id, u.nickname || u.display_name || '（名前未設定）']));

      const displayResponses = responsesData.map((r: any) => ({
        userId: r.user_id,
        nickname: usersMap.get(r.user_id) || '（不明な生徒）',
        responses: r.responses || {},
      }));
      setResponses(displayResponses);
    } catch (err) {
      console.error('Error fetching survey results:', err);
      setError(err instanceof Error ? err.message : 'データ取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }, [surveyModelId]);

  useEffect(() => { if (!authLoading) fetchData(); }, [authLoading, fetchData]);

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
        <Link href="/admin/surveys" className="mt-6 inline-block bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg">アンケート管理に戻る</Link>
      </div>
    );
  }

  const questionLabels = surveyModel?.form_fields.map((f) => f.label) || [];

  return (
    <div className="w-full max-w-7xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 animate-fade-in mt-8 mx-auto">
      <div className="flex justify-between items-start mb-6 border-b dark:border-gray-700 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">アンケート結果</h1>
          {surveyModel && <p className="text-gray-500 dark:text-gray-400 mt-1">{surveyModel.title}</p>}
        </div>
        <Link href="/admin/surveys" className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0 mt-1">&larr; アンケート管理に戻る</Link>
      </div>
      {responses.length > 0 && (
        <div className="text-right mb-4">
          <span className="font-semibold text-gray-700 dark:text-gray-300">総回答数: {responses.length}件</span>
        </div>
      )}

      {!surveyModel || responses.length === 0 ? (
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-gray-600 dark:text-gray-400">このアンケートに対する回答はまだありません。</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">回答者</th>
                {questionLabels.map((label) => (
                  <th key={label} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider min-w-[250px]">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {responses.map((response, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-6 py-4 whitespace-nowrap">
                    <Link href={`/admin/student/${response.userId}`} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">{response.nickname}</Link>
                  </td>
                  {questionLabels.map((label) => {
                    const answer = response.responses[label] || '';
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
