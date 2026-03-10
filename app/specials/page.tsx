'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type SpecialCourse = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  entry_start: string;
  entry_end: string;
};

const statusMap: { [key: string]: { text: string; style: string } } = {
  applied: { text: '申込完了', style: 'bg-blue-200 text-blue-800 dark:bg-blue-700 dark:text-blue-100' },
  contracted: { text: '契約完了', style: 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100' },
};

export default function SpecialsPage() {
  const { currentUser } = useAuth();
  const [specials, setSpecials] = useState<SpecialCourse[]>([]);
  const [entryStatuses, setEntryStatuses] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOpenSpecials = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const now = new Date().toISOString();

        // Fetch open special courses: entry_start <= now AND entry_end >= now
        const { data: specialsData, error: specialsError } = await supabase
          .from('specials')
          .select('id, title, description, thumbnail_url, entry_start, entry_end')
          .lte('entry_start', now)
          .gte('entry_end', now);

        if (specialsError) throw specialsError;
        setSpecials(specialsData || []);

        // Fetch user's entry statuses if logged in
        if (currentUser) {
          const { data: entriesData, error: entriesError } = await supabase
            .from('entries')
            .select('special_id, status')
            .eq('user_id', currentUser.id);

          if (entriesError) throw entriesError;
          const statuses = new Map<string, string>();
          (entriesData || []).forEach((entry: any) => {
            statuses.set(entry.special_id, entry.status);
          });
          setEntryStatuses(statuses);
        }
      } catch (err) {
        console.error('Error fetching open special courses:', err);
        setError('講座情報の取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };

    fetchOpenSpecials();
  }, [currentUser]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-pink-500 border-dashed rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">講座を検索中...</p>
        </div>
      );
    }
    if (error) {
      return <div className="text-center text-red-500 py-12">{error}</div>;
    }
    if (specials.length === 0) {
      return <div className="text-center text-gray-500 dark:text-gray-400 py-12">現在、申し込み可能な特別講座はありません。</div>;
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {specials.map(special => {
          const statusKey = entryStatuses.get(special.id);
          const statusInfo = statusKey ? statusMap[statusKey] : null;

          const cardContent = (
            <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden h-full flex flex-col transition-all duration-300 ${statusInfo ? 'opacity-70' : 'transform group-hover:-translate-y-1 group-hover:shadow-xl'}`}>
              <div className="relative">
                <img
                  src={special.thumbnail_url || `https://picsum.photos/seed/${special.id}/400/200`}
                  alt={special.title}
                  className="w-full h-48 object-cover"
                />
                {statusInfo && (
                  <div className={`absolute top-2 right-2 text-xs font-semibold px-3 py-1 rounded-full ${statusInfo.style}`}>
                    {statusInfo.text}
                  </div>
                )}
              </div>
              <div className="p-6 flex flex-col flex-grow">
                <h2 className={`text-xl font-bold text-gray-900 dark:text-white line-clamp-2 ${!statusInfo && 'group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors duration-300'}`}>
                  {special.title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-4">
                  申込期間: {new Date(special.entry_start).toLocaleDateString('ja-JP')} ~ {new Date(special.entry_end).toLocaleDateString('ja-JP')}
                </p>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed flex-grow line-clamp-3">
                  {special.description}
                </p>
                {!statusInfo && (
                  <div className="text-right mt-4 text-pink-600 dark:text-pink-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    詳細を見る &rarr;
                  </div>
                )}
              </div>
            </div>
          );

          if (statusInfo) {
            return <div key={special.id}>{cardContent}</div>;
          }

          return (
            <Link key={special.id} href={`/specials/${special.id}`} className="block group">
              {cardContent}
            </Link>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl animate-fade-in mt-8 space-y-8 mx-auto px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">特別講座一覧</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">現在お申し込み可能な特別講座の一覧です。</p>
      </div>
      {renderContent()}
    </div>
  );
}
