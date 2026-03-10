'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

type Category = {
  id: string;
  name: string;
};

export default function EditPostPage() {
  const { postId } = useParams<{ postId: string }>();
  const { currentUser, loading: authLoading } = useAuth();
  const supabase = createClient();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading || !postId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [postRes, categoriesRes] = await Promise.all([
          (supabase.from('timeline_posts') as any)
            .select('*')
            .eq('id', postId)
            .single(),
          (supabase.from('categories') as any).select('id, name').order('name'),
        ]);

        if (postRes.data) {
          const post = postRes.data;
          setTitle(post.title || '');
          setContent(post.content || '');
          setExcerpt(post.excerpt || '');
          setCategoryId(post.category_id || '');
          setImageUrl(post.image_url || '');
        }

        if (categoriesRes.data) {
          setCategories(categoriesRes.data as Category[]);
        }
      } catch (error) {
        console.error('Error fetching post:', error);
        alert('記事の読み込みに失敗しました。');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [postId, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('タイトルと本文は必須です。');
      return;
    }
    setSaving(true);

    try {
      const updateData = {
        title: title.trim(),
        content: content.trim(),
        excerpt: excerpt.trim() || null,
        category_id: categoryId || null,
        image_url: imageUrl.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase.from('timeline_posts') as any)
        .update(updateData)
        .eq('id', postId);
      if (error) throw error;

      alert('記事を更新しました。');
      router.push('/admin/posts');
    } catch (error) {
      console.error('Error updating post:', error);
      alert('記事の更新に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl animate-fade-in mt-8">
      <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4 gap-2">
        <Link href="/admin/posts" className="hover:text-blue-600 dark:hover:text-blue-400">記事管理</Link>
        <span>/</span>
        <span className="text-gray-800 dark:text-white font-medium">編集</span>
      </nav>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">記事編集</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タイトル *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-lg"
              placeholder="記事のタイトル"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">カテゴリ</label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"
            >
              <option value="">カテゴリなし</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">概要（リスト表示用）</label>
            <input
              type="text"
              value={excerpt}
              onChange={e => setExcerpt(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"
              placeholder="記事の概要（省略可）"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">画像URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"
              placeholder="https://example.com/image.jpg"
            />
            {imageUrl && (
              <div className="mt-2">
                <img src={imageUrl} alt="Preview" className="max-h-40 rounded-lg object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">本文 *</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={15}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md font-mono text-sm"
              placeholder="記事の本文を入力..."
              required
            />
          </div>

          <div className="flex justify-between items-center pt-4 border-t dark:border-gray-700">
            <Link href="/admin/posts" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              キャンセル
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-colors disabled:bg-gray-400"
            >
              {saving ? '更新中...' : '記事を更新'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
