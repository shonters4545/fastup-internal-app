'use client';

import React, { useState, useEffect } from 'react';

interface SurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (responses: { [key: string]: string | string[] }) => Promise<void>;
  classTitle?: string;
  classStartTime?: string;
  classEndTime?: string;
  surveyTitle: string;
  formFields: { label: string; type: 'text' | 'select'; options?: string[]; required?: boolean }[];
  isSubmitting: boolean;
}

const formatTimestamp = (ts: string): string => {
  if (!ts) return '';
  const date = new Date(ts);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function SurveyModal({ isOpen, onClose, onSubmit, classTitle, classStartTime, classEndTime, surveyTitle, formFields, isSubmitting }: SurveyModalProps) {
  const [responses, setResponses] = useState<{ [key: string]: string | string[] }>({});

  useEffect(() => {
    if (isOpen) {
      const initialResponses: { [key: string]: string | string[] } = {};
      formFields.forEach(field => {
        initialResponses[field.label] = '';
      });
      setResponses(initialResponses);
    }
  }, [isOpen, formFields]);

  const handleInputChange = (label: string, value: string | string[]) => {
    setResponses(prev => ({ ...prev, [label]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    for (const field of formFields) {
      if (field.required !== false && (!responses[field.label] || responses[field.label] === '')) {
        alert(`「${field.label}」に回答してください。`);
        return;
      }
    }
    onSubmit(responses);
  };

  if (!isOpen) return null;

  const isGeneralSurvey = !classTitle;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={isGeneralSurvey ? undefined : onClose}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="pb-4 border-b dark:border-gray-700">
          {classTitle && classStartTime && classEndTime && (
            <>
              <h3 className="text-sm text-gray-500 dark:text-gray-400">「{classTitle}」のアンケート</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {formatTimestamp(classStartTime)} ~ {formatTimestamp(classEndTime)}
              </p>
            </>
          )}
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mt-1">{surveyTitle}</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 my-6 flex-grow overflow-y-auto pr-2">
          {formFields.map((field, index) => (
            <div key={index}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {field.label}
                {field.required !== false && <span className="text-red-500 ml-1">*</span>}
              </label>
              {field.type === 'text' ? (
                <textarea
                  value={(responses[field.label] as string) || ''}
                  onChange={e => handleInputChange(field.label, e.target.value)}
                  rows={4}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"
                  required={field.required !== false}
                />
              ) : field.type === 'select' && field.options ? (
                <select
                  value={(responses[field.label] as string) || ''}
                  onChange={e => handleInputChange(field.label, e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"
                  required={field.required !== false}
                >
                  <option value="" disabled>-- 選択してください --</option>
                  {field.options.map((option, optIndex) => (
                    <option key={optIndex} value={option}>{option}</option>
                  ))}
                </select>
              ) : null}
            </div>
          ))}
        </form>
        <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
          {!isGeneralSurvey && (
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 bg-gray-200 dark:bg-gray-500 rounded-md text-sm">後で回答する</button>
          )}
          <button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:bg-gray-400">
            {isSubmitting ? '送信中...' : 'アンケートを送信'}
          </button>
        </div>
      </div>
    </div>
  );
}
