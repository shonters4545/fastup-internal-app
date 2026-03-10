'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type Instructor = {
  id: string;
  display_name: string;
  email: string;
  role: 'admin' | 'super';
};

// --- Invite Modal ---
function InviteModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'super'>('admin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('すべての必須項目を入力してください。');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      const supabase = createClient();
      const farFutureDate = new Date('2099-12-31T23:59:59').toISOString();

      const { error: insertError } = await (supabase.from('invites') as any).insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        status: 'pending',
        contract_start_date: new Date().toISOString(),
        contract_end_date: farFutureDate,
        payment_method: 'admin_account',
      });

      if (insertError) throw insertError;

      alert(
        '講師を招待しました。対象者は登録したメールアドレスでGoogleログインをするよう伝えてください。'
      );
      onSuccess();
    } catch (err) {
      console.error('Error creating instructor invite:', err);
      setError('招待処理中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-6 text-gray-800 dark:text-white">講師を新規招待</h3>
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label
              htmlFor="instructor-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              名前
            </label>
            <input
              type="text"
              id="instructor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-gray-900 dark:text-white"
              required
            />
          </div>
          <div>
            <label
              htmlFor="instructor-email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              メールアドレス
            </label>
            <input
              type="email"
              id="instructor-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-gray-900 dark:text-white"
              required
            />
          </div>
          <div>
            <label
              htmlFor="instructor-role"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              権限
            </label>
            <select
              id="instructor-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'super')}
              className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-gray-900 dark:text-white"
              required
            >
              <option value="admin">admin (管理者)</option>
              <option value="super">super (最高管理者)</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-500 rounded-md text-sm"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:bg-gray-400"
            >
              {isSubmitting ? '招待中...' : '招待する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Invited Instructors Modal ---
function InvitedInstructorsModal({ onClose }: { onClose: () => void }) {
  const [invites, setInvites] = useState<
    { id: string; name: string; email: string; role: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchInvites = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await (supabase.from('invites') as any)
        .select('id, name, email, role')
        .eq('status', 'pending')
        .in('role', ['admin', 'super']);

      if (error) throw error;
      setInvites(data || []);
    } catch (err) {
      console.error('Error fetching instructor invites:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const handleDeleteInvite = async (inviteId: string) => {
    if (window.confirm('本当にこの招待を取り消しますか？')) {
      setIsDeleting(inviteId);
      try {
        const supabase = createClient();
        const { error } = await (supabase.from('invites') as any)
          .delete()
          .eq('id', inviteId);
        if (error) throw error;
        fetchInvites();
      } catch (err) {
        console.error('Error deleting invite:', err);
        alert('招待の取り消しに失敗しました。');
      } finally {
        setIsDeleting(null);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-6 text-gray-800 dark:text-white">招待中の講師</h3>
        {loading ? (
          <p className="text-center text-gray-500 dark:text-gray-400">読み込み中...</p>
        ) : invites.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400">
            現在、招待中の講師はいません。
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
            {invites.map((invite) => (
              <li key={invite.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {invite.name}
                    <span className="ml-2 text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400 uppercase font-bold">
                      {invite.role}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{invite.email}</p>
                </div>
                <button
                  onClick={() => handleDeleteInvite(invite.id)}
                  disabled={isDeleting === invite.id}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200 rounded-full hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors disabled:opacity-50"
                >
                  {isDeleting === invite.id ? '取消中...' : '招待を取り消し'}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end pt-4 mt-4 border-t dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-500 rounded-md text-sm"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function AdminInstructorListPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInvitedModalOpen, setIsInvitedModalOpen] = useState(false);

  const fetchInstructors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await (supabase.from('users') as any)
        .select('id, display_name, email, role')
        .in('role', ['admin', 'super']);

      if (fetchError) throw fetchError;
      setInstructors(data || []);
    } catch (err) {
      console.error('Failed to fetch instructors:', err);
      setError('講師一覧の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!currentUser || currentUser.role !== 'super') {
      setError('このページへのアクセス権限がありません。');
      setLoading(false);
      return;
    }

    fetchInstructors();
  }, [currentUser, authLoading, fetchInstructors]);

  const handleDelete = async (instructorId: string, instructorName: string) => {
    if (
      window.confirm(
        `${instructorName}さんを削除します。この操作は元に戻せません。よろしいですか？`
      )
    ) {
      try {
        const supabase = createClient();
        const { error: deleteError } = await (supabase.from('users') as any)
          .delete()
          .eq('id', instructorId);
        if (deleteError) throw deleteError;
        fetchInstructors();
      } catch (err) {
        console.error('Error deleting instructor:', err);
        alert('講師の削除に失敗しました。');
      }
    }
  };

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-4xl text-center p-8 mx-auto mt-8">
        <div className="w-12 h-12 border-4 border-red-500 border-dashed rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-300 mt-4">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-lg text-center p-8 bg-red-100 dark:bg-red-900/50 rounded-lg mx-auto mt-8">
        <h2 className="text-2xl font-bold text-red-800 dark:text-red-200">エラー</h2>
        <p className="mt-2 text-red-600 dark:text-red-300">{error}</p>
        <Link
          href="/"
          className="mt-6 inline-block bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg"
        >
          トップページに戻る
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mx-auto mt-8">
        <div className="flex justify-between items-center mb-6 border-b dark:border-gray-700 pb-4">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">講師一覧</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsInvitedModalOpen(true)}
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors"
            >
              招待中の講師
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors"
            >
              講師を招待
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  名前
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  メールアドレス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  権限
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {instructors.map((instructor) => (
                <tr key={instructor.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {instructor.display_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {instructor.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 uppercase">
                    {instructor.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/admin/instructor/${instructor.id}`}
                      className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200"
                    >
                      詳細/編集
                    </Link>
                    <button
                      onClick={() => handleDelete(instructor.id, instructor.display_name)}
                      className="ml-4 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <InviteModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchInstructors();
          }}
        />
      )}
      {isInvitedModalOpen && (
        <InvitedInstructorsModal onClose={() => setIsInvitedModalOpen(false)} />
      )}
    </>
  );
}
