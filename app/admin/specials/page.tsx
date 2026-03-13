'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { uploadFile, generatePath } from '@/lib/supabase/storage';
import { useAuth } from '@/hooks/useAuth';

type SpecialCourse = {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  capacity: number | null;
  created_at: string;
};

type ContractedStudent = {
  userId: string;
  nickname: string;
};

// --- Contracted Students Modal ---
function ContractedStudentsModal({
  isOpen,
  onClose,
  specialId,
}: {
  isOpen: boolean;
  onClose: () => void;
  specialId: string | null;
}) {
  const [students, setStudents] = useState<ContractedStudent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !specialId) {
      setStudents([]);
      return;
    }

    const fetchContractedStudents = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: entries } = await (supabase.from('entries') as any)
          .select('user_id')
          .eq('special_id', specialId)
          .eq('status', 'contracted');

        if (entries && entries.length > 0) {
          const userIds = entries.map((e: any) => e.user_id);
          const { data: users } = await (supabase.from('users') as any)
            .select('id, nickname')
            .in('id', userIds);

          setStudents(
            (users || []).map((u: any) => ({
              userId: u.id,
              nickname: u.nickname || '名前未設定',
            }))
          );
        } else {
          setStudents([]);
        }
      } catch (error) {
        console.error('Error fetching contracted students:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContractedStudents();
  }, [isOpen, specialId]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="modal-content w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4 text-primary-800 dark:text-warm-100 border-b dark:border-primary-800 pb-3">
          契約者一覧
        </h3>
        <div className="flex-grow overflow-y-auto">
          {loading ? (
            <p className="text-center text-warm-500 dark:text-warm-400">読み込み中...</p>
          ) : students.length === 0 ? (
            <p className="text-center text-warm-500 dark:text-warm-400">契約者はいません。</p>
          ) : (
            <ul className="divide-y divide-warm-200 dark:divide-primary-800">
              {students.map((student) => (
                <li key={student.userId} className="py-3">
                  <Link
                    href={`/admin/student/${student.userId}`}
                    className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {student.nickname}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end pt-4 mt-4 border-t dark:border-primary-800">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSpecialsPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [specials, setSpecials] = useState<SpecialCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpecial, setEditingSpecial] = useState<SpecialCourse | null>(null);

  // Contract modal state
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [selectedSpecialId, setSelectedSpecialId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [capacity, setCapacity] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchSpecials = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await (supabase.from('specials') as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setSpecials(data || []);
    } catch (err) {
      console.error('Error fetching special courses:', err);
      setError('講座一覧の読み込みに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && currentUser) {
      fetchSpecials();
    }
  }, [authLoading, currentUser]);

  const resetModalState = () => {
    setTitle('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setCapacity('');
    setThumbnailFile(null);
    setIsSubmitting(false);
    setError('');
    setEditingSpecial(null);
  };

  const handleOpenCreateModal = () => {
    resetModalState();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (special: SpecialCourse) => {
    setEditingSpecial(special);
    setTitle(special.title);
    setDescription(special.description || '');
    setStartDate(special.start_date ? special.start_date.slice(0, 16) : '');
    setEndDate(special.end_date ? special.end_date.slice(0, 16) : '');
    setCapacity(special.capacity != null ? String(special.capacity) : '');
    setError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
  };

  const handleDelete = async (specialId: string) => {
    if (window.confirm('この特別講座を本当に削除しますか？この操作は元に戻せません。')) {
      try {
        const supabase = createClient();
        const { error: deleteError } = await (supabase.from('specials') as any)
          .delete()
          .eq('id', specialId);
        if (deleteError) throw deleteError;
        fetchSpecials();
      } catch (err) {
        console.error('Error deleting special course:', err);
        alert('講座の削除に失敗しました。');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title || !startDate || !endDate) {
      setError('タイトル、開始日時、終了日時は必須です。');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();

      let thumbnailUrl: string | undefined;
      if (thumbnailFile) {
        const path = generatePath('specials', thumbnailFile.name);
        thumbnailUrl = await uploadFile('post-thumbnails', path, thumbnailFile);
      }

      const specialData: any = {
        title,
        description,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        capacity: capacity ? parseInt(capacity, 10) : null,
      };
      if (thumbnailUrl) specialData.thumbnail_url = thumbnailUrl;

      if (editingSpecial) {
        const { error: updateError } = await (supabase.from('specials') as any)
          .update(specialData)
          .eq('id', editingSpecial.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await (supabase.from('specials') as any)
          .insert(specialData);
        if (insertError) throw insertError;
      }

      handleCloseModal();
      fetchSpecials();
    } catch (err: any) {
      console.error('Error submitting special course:', err);
      setError(err.message || '処理中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-6xl mx-auto text-center p-8">
        <div className="spinner mx-auto"></div>
      </div>
    );
  }

  if (!authLoading && currentUser && !['admin', 'super'].includes(currentUser.role)) {
    router.push('/');
    return null;
  }

  return (
    <>
      <div className="w-full max-w-6xl card p-8 mx-auto mt-8">
        <div className="flex justify-between items-center mb-6 border-b dark:border-primary-800 pb-4">
          <h1 className="text-3xl font-bold text-primary-800 dark:text-warm-100">特別講座管理</h1>
          <button
            onClick={handleOpenCreateModal}
            className="btn-primary"
          >
            特別講座を追加する
          </button>
        </div>

        {error && !isModalOpen ? (
          <div className="text-center py-10">
            <p className="text-danger-500">{error}</p>
          </div>
        ) : specials.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-warm-500 dark:text-warm-400">登録されている特別講座はありません。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-warm-200 dark:divide-primary-800">
              <thead className="bg-warm-50 dark:bg-primary-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-warm-500 dark:text-warm-300 uppercase">
                    講座名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-warm-500 dark:text-warm-300 uppercase">
                    エントリー期間
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-warm-500 dark:text-warm-300 uppercase">
                    定員
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-warm-500 dark:text-warm-300 uppercase">
                    管理
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-primary-900 divide-y divide-warm-200 dark:divide-primary-800">
                {specials.map((special) => (
                  <tr key={special.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-primary-800 dark:text-warm-100">
                        {special.title}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-warm-500 dark:text-warm-400">
                      {new Date(special.start_date).toLocaleDateString('ja-JP')} ~{' '}
                      {new Date(special.end_date).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-warm-500 dark:text-warm-400">
                      {special.capacity != null ? `${special.capacity}名` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center items-center gap-2">
                        <Link
                          href={`/admin/specials/${special.id}/entries`}
                          className="px-3 py-1 text-sm bg-primary-500 text-white rounded-btn hover:bg-primary-600"
                        >
                          申込一覧
                        </Link>
                        <button
                          onClick={() => {
                            setSelectedSpecialId(special.id);
                            setIsContractModalOpen(true);
                          }}
                          className="px-3 py-1 text-sm bg-success-500 text-white rounded-btn hover:bg-success-600"
                        >
                          契約者一覧
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleOpenEditModal(special)}
                        className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-200"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(special.id)}
                        className="ml-4 text-danger-600 hover:text-danger-900 dark:text-danger-400 dark:hover:text-danger-200"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ContractedStudentsModal
        isOpen={isContractModalOpen}
        onClose={() => setIsContractModalOpen(false)}
        specialId={selectedSpecialId}
      />

      {isModalOpen && (
        <div
          className="modal-overlay"
          onClick={handleCloseModal}
        >
          <div
            className="modal-content w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-6 text-primary-800 dark:text-warm-100">
              {editingSpecial ? '特別講座を編集する' : '特別講座を追加する'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="title"
                  className="label"
                >
                  名前
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="description"
                  className="label"
                >
                  概要文
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input mt-1"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="start-date"
                    className="label"
                  >
                    エントリー開始日時
                  </label>
                  <input
                    type="datetime-local"
                    id="start-date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input mt-1"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="end-date"
                    className="label"
                  >
                    エントリー終了日時
                  </label>
                  <input
                    type="datetime-local"
                    id="end-date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input mt-1"
                    required
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="capacity"
                  className="label"
                >
                  定員（任意）
                </label>
                <input
                  type="number"
                  id="capacity"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="input mt-1"
                  min="0"
                />
              </div>

              <div>
                <label className="label">
                  サムネイル画像（任意）
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                  className="input mt-1 text-sm"
                />
              </div>

              {error && <p className="text-sm text-danger-500">{error}</p>}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="btn-ghost"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary disabled:opacity-50"
                >
                  {isSubmitting
                    ? editingSpecial
                      ? '更新中...'
                      : '追加中...'
                    : editingSpecial
                    ? '更新する'
                    : '追加する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
