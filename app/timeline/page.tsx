'use client';

import { useState, useEffect } from 'react';
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

type Category = {
  id: string;
  name: string;
  display_order: number;
};

export default function TimelinePage() {
  const [posts, setPosts] = useState<TimelinePost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id, name, display_order')
          .order('display_order', { ascending: true });

        if (error) throw error;
        setCategories(data || []);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    const fetchPosts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('timeline_posts')
          .select('id, title, content, author_name, thumbnail_url, category_id, created_at')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPosts(data || []);
      } catch (error) {
        console.error('Error fetching timeline posts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
    fetchPosts();
  }, []);

  const filteredPosts = selectedCategory
    ? posts.filter(post => post.category_id === selectedCategory)
    : posts;

  const createSnippet = (htmlContent: string, length: number = 100) => {
    const div = document.createElement('div');
    div.innerHTML = htmlContent;
    const text = div.textContent || div.innerText || '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  };

  if (loading && posts.length === 0) {
    return (
      <div className="w-full max-w-4xl text-center p-8 animate-fade-in mt-8">
        <div className="w-12 h-12 border-4 border-cyan-500 border-dashed rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-300 mt-4">お知らせを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl animate-fade-in mt-8 space-y-8 mx-auto px-4">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white text-center">お知らせタイムライン</h1>

      {categories.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 pb-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 text-sm font-medium rounded-full transition ${
              !selectedCategory
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            すべて
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 text-sm font-medium rounded-full transition ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredPosts.length > 0 ? (
          filteredPosts.map(post => (
            <Link key={post.id} href={`/timeline/${post.id}`} className="block group">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden h-full flex flex-col transition-all duration-300 transform group-hover:-translate-y-1 group-hover:shadow-xl">
                {post.thumbnail_url ? (
                  <img src={post.thumbnail_url} alt={post.title} className="w-full h-48 object-cover" />
                ) : (
                  <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                  </div>
                )}
                <div className="p-6 flex flex-col flex-grow">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300 line-clamp-2">
                    {post.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-4">
                    {new Date(post.created_at).toLocaleDateString('ja-JP')}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed flex-grow line-clamp-3">
                    {createSnippet(post.content, 100)}
                  </p>
                  <div className="text-right mt-4 text-blue-600 dark:text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    続きを読む &rarr;
                  </div>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400">
              {selectedCategory ? 'このカテゴリーのお知らせはありません。' : 'お知らせはまだありません。'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
