'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type TimelinePost = {
  id: string;
  title: string;
  content: string;
  author_name?: string;
  thumbnail_url?: string;
  category_id?: string;
  created_at: string;
};

export default function PostDetailPage() {
  const params = useParams();
  const postId = params.postId as string;
  const [post, setPost] = useState<TimelinePost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) {
        setError('記事IDが見つかりません。');
        setLoading(false);
        return;
      }
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('timeline_posts')
          .select('id, title, content, author_name, thumbnail_url, category_id, created_at')
          .eq('id', postId)
          .single();

        if (fetchError) throw fetchError;

        if (data) {
          setPost(data);
        } else {
          setError('記事が見つかりませんでした。');
        }
      } catch (err) {
        console.error('Error fetching post:', err);
        setError('記事の読み込み中にエラーが発生しました。');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  if (loading) {
    return (
      <div className="w-full max-w-4xl text-center p-8 animate-fade-in mt-8">
        <div className="spinner mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-300 mt-4">記事を読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-lg text-center p-8 bg-danger-100 dark:bg-danger-900/50 rounded-btn animate-fade-in mt-8">
        <h2 className="text-2xl font-bold text-danger-800 dark:text-danger-200">エラー</h2>
        <p className="mt-2 text-danger-600 dark:text-danger-300">{error}</p>
        <Link
          href="/timeline"
          className="btn-danger mt-6 inline-block"
        >
          タイムラインに戻る
        </Link>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="w-full max-w-3xl animate-fade-in mt-8 space-y-8 mx-auto px-4">
      <style>{`
        .prose-styles h1, .prose-styles h2, .prose-styles h3 { margin-top: 1.5rem; margin-bottom: 1rem; font-weight: bold; }
        .prose-styles h1 { font-size: 2rem; }
        .prose-styles h2 { font-size: 1.75rem; }
        .prose-styles h3 { font-size: 1.5rem; }
        .prose-styles p { margin-bottom: 1rem; line-height: 1.7; }
        .prose-styles a { color: #3b82f6; text-decoration: underline; }
        .prose-styles img { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 1.5rem 0; }
        .prose-styles blockquote { border-left: 4px solid #d1d5db; padding-left: 1rem; margin-left: 0; font-style: italic; color: #6b7280; }
        .prose-styles ul, .prose-styles ol { margin-left: 1.5rem; margin-bottom: 1rem; }
        .prose-styles li { margin-bottom: 0.5rem; }
      `}</style>

      <div className="text-left mb-8">
        <Link href="/timeline" className="text-primary-600 dark:text-gray-400 hover:underline">
          &larr; タイムラインに戻る
        </Link>
      </div>

      <article className="card overflow-hidden">
        {post.thumbnail_url && (
          <img src={post.thumbnail_url} alt={post.title} className="w-full h-80 object-cover" />
        )}
        <div className="p-8 md:p-12">
          <h1 className="text-4xl font-extrabold text-gray-800 dark:text-gray-100">{post.title}</h1>
          <div className="text-base text-gray-500 dark:text-gray-400 mt-4 mb-8">
            <span>{post.author_name}</span>
            <span className="mx-2">&middot;</span>
            <span>{new Date(post.created_at).toLocaleDateString('ja-JP')}</span>
          </div>
          <div
            className="text-gray-800 dark:text-gray-200 leading-relaxed prose-styles"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </div>
      </article>
    </div>
  );
}
