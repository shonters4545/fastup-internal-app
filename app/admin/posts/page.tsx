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
        <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto" />
        <p className="text-gray-600 dark:text-gray-300 mt-4">記事を読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 animate-fade-in mt-8">
      <div className="flex justify-between items-center mb-6 border-b dark:border-gray-700 pb-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">記事管理</h1>
        <button
          onClick={() => router.push('/admin/create-post')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-lg hover:shadow-xl"
        >
          新規記事作成
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">
          <p>記事がありません。</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">タイトル</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">カテゴリ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">作成者</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">作成日時</th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {posts.map(post => (
                <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/timeline/${post.id}`} className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                      {post.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500 dark:text-gray-300">
                      {post.category_id ? categories.get(post.category_id) || '-' : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-300">{post.author_name || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-300">
                      {new Date(post.created_at).toLocaleString('ja-JP')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/admin/edit-post/${post.id}`} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200">編集</Link>
                    <button onClick={() => handleDelete(post.id)} className="ml-4 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200">削除</button>
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
