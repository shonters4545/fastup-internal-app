'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadFile, generatePath } from '@/lib/supabase/storage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  divisionId: string;
  subjectId: string;
  onAdded: () => void;
}

export default function AddCustomBookModal({ isOpen, onClose, userId, divisionId, subjectId, onAdded }: Props) {
  const [bookName, setBookName] = useState('');
  const [maxLaps, setMaxLaps] = useState(1);
  const [taskNames, setTaskNames] = useState<string[]>(['']);
  const [remarks, setRemarks] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  if (!isOpen) return null;

  const handleTaskNameChange = (index: number, value: string) => {
    const newNames = [...taskNames];
    newNames[index] = value;
    setTaskNames(newNames);
  };

  const addTaskField = () => {
    setTaskNames([...taskNames, '']);
  };

  const removeTaskField = (index: number) => {
    setTaskNames(taskNames.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setBookName('');
    setMaxLaps(1);
    setTaskNames(['']);
    setRemarks('');
    setImageFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookName.trim()) {
      alert('参考書名を入力してください');
      return;
    }
    const validTasks = taskNames.filter(t => t.trim() !== '');
    if (validTasks.length === 0) {
      alert('少なくとも1つのタスクを入力してください');
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload image if provided
      let imageUrl: string | null = null;
      if (imageFile) {
        const path = generatePath(`custom/${userId}`, imageFile.name);
        imageUrl = await uploadFile('book-images', path, imageFile);
      }

      // 1. Create custom book
      const { data: book, error: bookError } = await (supabase.from('books') as any).insert({
        name: bookName,
        division_id: divisionId,
        subject_id: subjectId,
        max_laps: maxLaps,
        is_custom: true,
        remarks,
        image_url: imageUrl,
        user_id: userId,
        display_order: 9999,
      }).select('id').single();

      if (bookError) throw bookError;

      // 2. Create tasks
      const taskInserts = validTasks.map((name, index) => ({
        name,
        book_id: book.id,
        display_order: index + 1,
      }));
      const { error: tasksError } = await (supabase.from('tasks') as any).insert(taskInserts);
      if (tasksError) throw tasksError;

      onAdded();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error adding custom book:', error);
      alert('追加に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4 dark:text-white">カスタム参考書の追加</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">参考書名</label>
              <input
                type="text"
                value={bookName}
                onChange={(e) => setBookName(e.target.value)}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="例: 英単語帳（カスタム）"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">参考書画像（任意）</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">備考・指示（任意）</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white h-24"
                placeholder="やり方や注意事項などを記載してください"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">周回数</label>
              <input
                type="number"
                min="1"
                max="10"
                value={maxLaps}
                onChange={(e) => setMaxLaps(parseInt(e.target.value) || 1)}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タスク一覧</label>
              <div className="space-y-2">
                {taskNames.map((name, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleTaskNameChange(index, e.target.value)}
                      className="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder={`タスク ${index + 1}`}
                    />
                    {taskNames.length > 1 && (
                      <button type="button" onClick={() => removeTaskField(index)} className="text-red-500 hover:text-red-700 px-2">
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addTaskField} className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400">
                + タスクを追加
              </button>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded dark:text-gray-300 dark:hover:bg-gray-700">
                キャンセル
              </button>
              <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {isSubmitting ? '保存中...' : '追加する'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
