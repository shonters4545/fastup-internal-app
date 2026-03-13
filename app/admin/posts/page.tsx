'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

type TimelinePost = {
  id: string;
  title: string;
  author_name: string | null;
  category_id: string | null;
  created_at: string;
};

type Category = {
  id: string;
  name: string;
};

export default function AdminPostsListPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const supabase = createClient();
  const router = useRouter();
  const [posts, setPosts] = useState<TimelinePost[]>([]);
  const [categories, setCategories] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const [postsRes, categoriesRes] = await Promise.all([
        (supabase.from('timeline_posts') as any)
          .select('id, title, author_name, category_id, created_at')
          .order('created_at', { ascending: false }),
        (supabase.from('categories') as any).select('id, name'),
      ]);

      setPosts((postsRes.data || []) as TimelinePost[]);

      const catMap = new Map<string, string>();
      ((categoriesRes.data || []) as Category[]).forEach(c => catMap.set(c.id, c.name));
      setCategories(catMap);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchPosts();
  }, [authLoading]);

  const handleDelete = async (postId: string) => {
    if (!window.confirm('この記事を本当に削除しますか？')) return;
    try {
      const { error } = await (supabase.from('timeline_posts') as any).delete().eq('id', postId);
      if (error) throw error;
      fetchPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('記事の削除に失敗しました。');
    }
  };

  if (loading || authLoading) {
    return (
      <div className="w-full max-w-4xl text-center p-8 animate-fade-in mt-8">
        <div className="spinner mx-auto" />
        <p className="text-warm-600 dark:text-warm-300 mt-4">記事を読み込み中...</p>
      </div>
    );
  }

  if (!authLoading && currentUser && !['admin', 'super'].includes(currentUser.role)) {
    router.push('/');
    return null;
  }

  return (
    <div className="w-full max-w-6xl card p-8 animate-fade-in mt-8">
      <div className="flex justify-between items-center mb-6 border-b dark:border-primary-800 pb-4">
        <h1 className="text-3xl font-bold text-primary-800 dark:text-warm-100">記事管理</h1>
        <button
          onClick={() => router.push('/admin/create-post')}
          className="btn-primary"
        >
          新規記事作成
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="text-center text-warm-500 dark:text-warm-400 py-12">
          <p>記事がありません。</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-warm-200 dark:divide-primary-800">
            <thead className="bg-warm-50 dark:bg-primary-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-warm-500 dark:text-warm-300 uppercase tracking-wider">タイトル</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-warm-500 dark:text-warm-300 uppercase tracking-wider">カテゴリ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-warm-500 dark:text-warm-300 uppercase tracking-wider">作成者</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-warm-500 dark:text-warm-300 uppercase tracking-wider">作成日時</th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-primary-900 divide-y divide-warm-200 dark:divide-primary-800">
              {posts.map(post => (
                <tr key={post.id} className="hover:bg-warm-50 dark:hover:bg-primary-800/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/timeline/${post.id}`} className="text-sm font-medium text-primary-800 dark:text-warm-100 hover:text-primary-600 dark:hover:text-primary-400">
                      {post.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-warm-500 dark:text-warm-300">
                      {post.category_id ? categories.get(post.category_id) || '-' : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-warm-500 dark:text-warm-300">{post.author_name || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-warm-500 dark:text-warm-300">
                      {new Date(post.created_at).toLocaleString('ja-JP')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/admin/edit-post/${post.id}`} className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-200">編集</Link>
                    <button onClick={() => handleDelete(post.id)} className="ml-4 text-danger-600 hover:text-danger-900 dark:text-danger-400 dark:hover:text-danger-200">削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
