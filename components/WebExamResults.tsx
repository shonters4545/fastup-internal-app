'use client';

import { useState, useEffect } from 'react';
import type { WebExamResult } from '@/lib/types/webexam';

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-success-600 dark:text-success-400';
  if (score >= 60) return 'text-warning-600 dark:text-warning-400';
  return 'text-danger-600 dark:text-danger-400';
}

function getJudgeBadge(judge: string): { bg: string; text: string } {
  switch (judge) {
    case 'A': return { bg: 'bg-success-100 dark:bg-success-900/30', text: 'text-success-700 dark:text-success-300' };
    case 'B': return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' };
    case 'C': return { bg: 'bg-warning-100 dark:bg-warning-900/30', text: 'text-warning-700 dark:text-warning-300' };
    default: return { bg: 'bg-danger-100 dark:bg-danger-900/30', text: 'text-danger-700 dark:text-danger-300' };
  }
}

export default function WebExamResults({ userId }: { userId: string }) {
  const [results, setResults] = useState<WebExamResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/exam-results?userId=${userId}`)
      .then(res => res.json())
      .then(data => setResults(data.results || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-btn">
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">模試結果を取得中...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-btn">
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">模試結果はありません。</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-btn overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">模試名</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">科目</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">点数</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">偏差値</th>
              <th className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">判定</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">受験日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {results.map(r => {
              const badge = getJudgeBadge(r.judge);
              return (
                <tr key={r.id} className="hover:bg-gray-100 dark:hover:bg-gray-800/80">
                  <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-200">{r.exam_title}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{r.subject_name}</td>
                  <td className={`py-3 px-4 text-right font-bold ${getScoreColor(r.score)}`}>{r.score}</td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-800 dark:text-gray-200">{r.deviation_value}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
                      {r.judge}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">
                    {new Date(r.created_at).toLocaleDateString('ja-JP')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
