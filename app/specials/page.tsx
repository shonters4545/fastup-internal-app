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
  start_date: string;
  end_date: string;
};

const statusMap: { [key: string]: { text: string; style: string } } = {
  applied: { text: '申込完了', style: 'bg-primary-200 text-primary-800 dark:bg-primary-700 dark:text-primary-100' },
  contracted: { text: '契約完了', style: 'bg-success-200 text-success-800 dark:bg-success-700 dark:text-success-100' },
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
          .select('id, title, description, thumbnail_url, start_date, end_date')
          .lte('start_date', now)
          .gte('end_date', now);

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
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-warm-500 dark:text-warm-400">講座を検索中...</p>
        </div>
      );
    }
    if (error) {
      return <div className="text-center text-danger-500 py-12">{error}</div>;
    }
    if (specials.length === 0) {
      return <div className="text-center text-warm-500 dark:text-warm-400 py-12">現在、申し込み可能な特別講座はありません。</div>;
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {specials.map(special => {
          const statusKey = entryStatuses.get(special.id);
          const statusInfo = statusKey ? statusMap[statusKey] : null;

          const cardContent = (
            <div className={`bg-white dark:bg-primary-900 rounded-card shadow-card overflow-hidden h-full flex flex-col transition-all duration-300 ${statusInfo ? 'opacity-70' : 'transform group-hover:-translate-y-1 group-hover:shadow-card-hover'}`}>
              <div className="relative">
                <img
                  src={special.thumbnail_url || `https://picsum.photos/seed/${special.id}/400/200`}
                  alt={special.title}
                  className="w-full h-48 object-cover"
                />
                {statusInfo && (
                  <div className={`absolute top-2 right-2 text-xs font-semibold px-3 py-1 rounded-badge ${statusInfo.style}`}>
                    {statusInfo.text}
                  </div>
                )}
              </div>
              <div className="p-6 flex flex-col flex-grow">
                <h2 className={`text-xl font-bold text-primary-800 dark:text-warm-100 line-clamp-2 ${!statusInfo && 'group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors duration-300'}`}>
                  {special.title}
                </h2>
                <p className="text-sm text-warm-500 dark:text-warm-400 mt-2 mb-4">
                  申込期間: {new Date(special.start_date).toLocaleDateString('ja-JP')} ~ {new Date(special.end_date).toLocaleDateString('ja-JP')}
                </p>
                <p className="text-warm-600 dark:text-warm-300 leading-relaxed flex-grow line-clamp-3">
                  {special.description}
                </p>
                {!statusInfo && (
                  <div className="text-right mt-4 text-accent-600 dark:text-accent-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
        <h1 className="text-2xl font-bold text-primary-700 dark:text-warm-100 tracking-wider">特別講座一覧</h1>
        <p className="mt-2 text-warm-600 dark:text-warm-400">現在お申し込み可能な特別講座の一覧です。</p>
      </div>
      {renderContent()}
    </div>
  );
}
