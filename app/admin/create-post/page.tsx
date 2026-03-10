'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { uploadFile, generatePath } from '@/lib/supabase/storage';

type Category = {
  id: string;
  name: string;
};

export default function CreatePostPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const supabase = createClient();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await (supabase.from('categories') as any).select('id, name').order('name');
      if (data) setCategories(data as Category[]);
    };
    fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('タイトルと本文は必須です。');
      return;
    }
    if (!currentUser) return;
    setSaving(true);

    try {
      let finalImageUrl = imageUrl.trim() || null;
      if (imageFile) {
        const path = generatePath('posts', imageFile.name);
        finalImageUrl = await uploadFile('post-thumbnails', path, imageFile);
      }

      const postData = {
        title: title.trim(),
        content: content.trim(),
        excerpt: excerpt.trim() || null,
        category_id: categoryId || null,
        thumbnail_url: finalImageUrl,
        author_id: currentUser.id,
        author_name: currentUser.displayName || currentUser.email,
      };

      const { error } = await (supabase.from('timeline_posts') as any).insert(postData);
      if (error) throw error;

      alert('記事を作成しました。');
      router.push('/admin/posts');
    } catch (error) {
      console.error('Error creating post:', error);
      alert('記事の作成に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin" />
      </div>
    );
  }

  if (!authLoading && currentUser && !['admin', 'super'].includes(currentUser.role)) {
    router.push('/');
    return null;
  }

  return (
    <div className="w-full max-w-4xl animate-fade-in mt-8">
      <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4 gap-2">
        <Link href="/admin/posts" className="hover:text-blue-600 dark:hover:text-blue-400">記事管理</Link>
        <span>/</span>
        <span className="text-gray-800 dark:text-white font-medium">新規作成</span>
      </nav>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">記事作成</h1>

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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">画像アップロード</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => { setImageFile(e.target.files?.[0] || null); if (e.target.files?.[0]) setImageUrl(''); }}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">または画像URLを直接入力:</p>
            <input
              type="url"
              value={imageUrl}
              onChange={e => { setImageUrl(e.target.value); if (e.target.value) setImageFile(null); }}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md mt-1"
              placeholder="https://example.com/image.jpg"
            />
            {(imageUrl || imageFile) && (
              <div className="mt-2">
                {imageUrl && <img src={imageUrl} alt="Preview" className="max-h-40 rounded-lg object-cover" onError={e => (e.currentTarget.style.display = 'none')} />}
                {imageFile && <p className="text-sm text-green-600">{imageFile.name} が選択されています</p>}
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
              {saving ? '作成中...' : '記事を作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
