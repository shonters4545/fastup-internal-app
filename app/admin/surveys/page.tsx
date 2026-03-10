'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type SurveyModel = {
  id: string;
  title: string;
  type: string;
  created_at: string | null;
  updated_at: string | null;
  delivery_time: string | null;
  delivery_status: string | null;
};

export default function AdminSurveysListPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [surveys, setSurveys] = useState<SurveyModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestCounts, setRequestCounts] = useState<Map<string, number>>(new Map());
  const [responseCounts, setResponseCounts] = useState<Map<string, number>>(new Map());

  const fetchSurveys = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [surveysRes, requestsRes, responsesRes] = await Promise.all([
        (supabase.from('survey_models') as any).select('*').eq('type', 'general').order('updated_at', { ascending: false }),
        (supabase.from('survey_requests') as any).select('survey_model_id').eq('type', 'general'),
        (supabase.from('survey_responses') as any).select('survey_model_id').eq('type', 'general'),
      ]);
      if (surveysRes.error) throw surveysRes.error;
      setSurveys(surveysRes.data || []);

      const reqCounts = new Map<string, number>();
      (requestsRes.data || []).forEach((r: any) => {
        reqCounts.set(r.survey_model_id, (reqCounts.get(r.survey_model_id) || 0) + 1);
      });
      setRequestCounts(reqCounts);

      const resCounts = new Map<string, number>();
      (responsesRes.data || []).forEach((r: any) => {
        resCounts.set(r.survey_model_id, (resCounts.get(r.survey_model_id) || 0) + 1);
      });
      setResponseCounts(resCounts);
    } catch (error) {
      console.error('Error fetching general surveys:', error);
      alert('アンケートの読み込みに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchSurveys();
  }, [authLoading]);

  const handleDelete = async (surveyId: string, surveyTitle: string) => {
    if (window.confirm(`「${surveyTitle}」を本当に削除しますか？この操作は元に戻せません。`)) {
      try {
        const supabase = createClient();
        const { error } = await (supabase.from('survey_models') as any).delete().eq('id', surveyId);
        if (error) throw error;
        fetchSurveys();
      } catch (error) {
        console.error('Error deleting survey model:', error);
        alert('アンケートの削除に失敗しました。');
      }
    }
  };

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-4xl text-center p-8 animate-fade-in mt-8">
        <div className="w-12 h-12 border-4 border-sky-500 border-dashed rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-300 mt-4">アンケートを読み込み中...</p>
      </div>
    );
  }

  if (!authLoading && currentUser && !['admin', 'super'].includes(currentUser.role)) {
    router.push('/');
    return null;
  }

  return (
    <div className="w-full max-w-6xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 animate-fade-in mt-8">
      <div className="flex justify-between items-center mb-6 border-b dark:border-gray-700 pb-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">アンケート管理</h1>
        <button onClick={() => router.push('/admin/surveys/create')} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 shadow-lg hover:shadow-xl">
          新規アンケートを作成
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">タイトル</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ステータス</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">配信日時</th>
              <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {surveys.length > 0 ? surveys.map((survey) => {
              const statusMap: Record<string, { text: string; style: string }> = {
                scheduled: { text: '予約済み', style: 'bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100' },
                sent: { text: '配信済み', style: 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100' },
              };
              const statusInfo = survey.delivery_status ? statusMap[survey.delivery_status] : null;
              const requested = requestCounts.get(survey.id) || 0;
              const responded = responseCounts.get(survey.id) || 0;

              return (
                <tr key={survey.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{survey.title}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {statusInfo ? (
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusInfo.style}`}>{statusInfo.text}</span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-300">下書き</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-300">
                      {survey.delivery_time ? new Date(survey.delivery_time).toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未設定'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-4">
                      <div className="flex items-center">
                        {survey.delivery_status === 'sent' && requested > 0 && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">({responded}/{requested})</span>
                        )}
                        <Link href={`/admin/surveys/${survey.id}/results`} className="ml-2 text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-200">アンケート結果</Link>
                      </div>
                      {survey.delivery_status !== 'sent' && (
                        <Link href={`/admin/surveys/edit/${survey.id}`} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200">編集</Link>
                      )}
                      <button onClick={() => handleDelete(survey.id, survey.title)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200">削除</button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  全生徒向けアンケートはまだ作成されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
