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
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="modal-content w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-6 text-primary-800 dark:text-warm-100">講師を新規招待</h3>
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label
              htmlFor="instructor-name"
              className="label"
            >
              名前
            </label>
            <input
              type="text"
              id="instructor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input mt-1"
              required
            />
          </div>
          <div>
            <label
              htmlFor="instructor-email"
              className="label"
            >
              メールアドレス
            </label>
            <input
              type="email"
              id="instructor-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-1"
              required
            />
          </div>
          <div>
            <label
              htmlFor="instructor-role"
              className="label"
            >
              権限
            </label>
            <select
              id="instructor-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'super')}
              className="input mt-1"
              required
            >
              <option value="admin">admin (管理者)</option>
              <option value="super">super (最高管理者)</option>
            </select>
          </div>
          {error && <p className="text-sm text-danger-500 text-center">{error}</p>}
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
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
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="modal-content w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-6 text-primary-800 dark:text-warm-100">招待中の講師</h3>
        {loading ? (
          <p className="text-center text-warm-500 dark:text-warm-400">読み込み中...</p>
        ) : invites.length === 0 ? (
          <p className="text-center text-warm-500 dark:text-warm-400">
            現在、招待中の講師はいません。
          </p>
        ) : (
          <ul className="divide-y divide-warm-200 dark:divide-primary-800 max-h-80 overflow-y-auto">
            {invites.map((invite) => (
              <li key={invite.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-primary-800 dark:text-warm-100">
                    {invite.name}
                    <span className="ml-2 text-[10px] bg-warm-50 dark:bg-primary-800 px-1.5 py-0.5 rounded-badge text-warm-500 dark:text-warm-400 uppercase font-bold">
                      {invite.role}
                    </span>
                  </p>
                  <p className="text-sm text-warm-500 dark:text-warm-400">{invite.email}</p>
                </div>
                <button
                  onClick={() => handleDeleteInvite(invite.id)}
                  disabled={isDeleting === invite.id}
                  className="badge-danger cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {isDeleting === invite.id ? '取消中...' : '招待を取り消し'}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end pt-4 mt-4 border-t dark:border-primary-800">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
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
        <div className="spinner mx-auto"></div>
        <p className="text-warm-600 dark:text-warm-300 mt-4">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-lg text-center p-8 bg-danger-100 dark:bg-danger-900/50 rounded-card mx-auto mt-8">
        <h2 className="text-2xl font-bold text-danger-800 dark:text-danger-200">エラー</h2>
        <p className="mt-2 text-danger-600 dark:text-danger-300">{error}</p>
        <Link
          href="/"
          className="btn-danger mt-6 inline-block"
        >
          トップページに戻る
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="card w-full max-w-4xl mx-auto mt-8">
        <div className="flex justify-between items-center mb-6 border-b dark:border-primary-800 pb-4">
          <h1 className="text-2xl font-bold text-primary-700 dark:text-warm-100 tracking-wider">講師一覧</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsInvitedModalOpen(true)}
              className="btn-accent"
            >
              招待中の講師
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary"
            >
              講師を招待
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-warm-200 dark:divide-primary-800">
            <thead className="bg-warm-50 dark:bg-primary-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-warm-500 dark:text-warm-300 uppercase">
                  名前
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-warm-500 dark:text-warm-300 uppercase">
                  メールアドレス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-warm-500 dark:text-warm-300 uppercase">
                  権限
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-primary-900 divide-y divide-warm-200 dark:divide-primary-800">
              {instructors.map((instructor) => (
                <tr key={instructor.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-800 dark:text-warm-100">
                    {instructor.display_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-warm-500 dark:text-warm-400">
                    {instructor.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-warm-500 dark:text-warm-400 uppercase">
                    {instructor.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/admin/instructor/${instructor.id}`}
                      className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-200"
                    >
                      詳細/編集
                    </Link>
                    <button
                      onClick={() => handleDelete(instructor.id, instructor.display_name)}
                      className="ml-4 text-danger-600 hover:text-danger-700 dark:text-danger-400 dark:hover:text-danger-200"
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
