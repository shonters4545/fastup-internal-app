'use client';

import { useState } from 'react';

interface TestScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (score: number | null, isSkipped: boolean) => void;
  isSubmitting: boolean;
}

export default function TestScoreModal({ isOpen, onClose, onSubmit, isSubmitting }: TestScoreModalProps) {
  const [score, setScore] = useState('');

  if (!isOpen) return null;

  const handleScoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numScore = parseInt(score, 10);
    if (isNaN(numScore) || numScore < 0 || numScore > 100) {
      alert('0から100までの数値を入力してください。');
      return;
    }
    onSubmit(numScore, false);
    setScore('');
  };

  const handleSkip = () => {
    onSubmit(null, true);
    setScore('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white text-center">確認テストの結果</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
          このタスクの確認テストの点数を入力してください。<br />
          (100点満点)
        </p>

        <form onSubmit={handleScoreSubmit} className="space-y-4">
          <div>
            <input
              type="number"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="w-full text-center text-3xl font-bold p-3 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
              placeholder="80"
              min="0"
              max="100"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-3 mt-6">
            <button
              type="submit"
              disabled={isSubmitting || score === ''}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? '保存中...' : '点数を記録して完了'}
            </button>

            <button
              type="button"
              onClick={handleSkip}
              disabled={isSubmitting}
              className="w-full py-2 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-semibold rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
            >
              今回はテストなし
            </button>

            <button
              type="button"
              onClick={() => { onClose(); setScore(''); }}
              disabled={isSubmitting}
              className="w-full py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
