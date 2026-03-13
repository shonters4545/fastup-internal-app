'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

type PaymentMethod = 'bank_transfer_lump' | 'bank_transfer_monthly' | 'credit_card_lump' | 'credit_card_monthly';

type Contract = {
  id: string;
  user_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  payment_method: string | null;
  cancel_at_period_end: boolean;
  parent_email: string | null;
};

type SpecialContract = { id: string; title: string };

const formatDateForDisplay = (dateStr: string | undefined) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('ja-JP');
};

const formatPaymentMethod = (method?: string | null) => {
  switch (method) {
    case 'bank_transfer_lump': return '銀行振込　一括';
    case 'bank_transfer_monthly': return '銀行振込　月額';
    case 'credit_card_lump': return 'クレジット　一括';
    case 'credit_card_monthly': return 'クレジット　月額';
    default: return '未設定';
  }
};

export default function ContractPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [contract, setContract] = useState<Contract | null>(null);
  const [specialContracts, setSpecialContracts] = useState<SpecialContract[]>([]);
  const [personalContractSubjects, setPersonalContractSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    setError(null);
    try {
      // Fetch subjects map
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('id, name');
      const subjectsMap = new Map<string, string>();
      subjectsData?.forEach((s: any) => subjectsMap.set(s.id, s.name));

      // Fetch main contract
      const { data: contractData } = await supabase
        .from('contracts')
        .select('*')
        .eq('user_id', currentUser.id)
        .limit(1) as { data: any[] | null };

      if (contractData && contractData.length > 0) {
        setContract(contractData[0] as Contract);
      } else {
        setContract(null);
      }

      // Fetch special course contracts (entries with status 'contracted', joined with specials)
      const { data: specialEntriesData } = await supabase
        .from('entries')
        .select('id, special_id, status, specials(id, title)')
        .eq('user_id', currentUser.id)
        .eq('status', 'contracted') as { data: any[] | null };

      if (specialEntriesData && specialEntriesData.length > 0) {
        const specials = specialEntriesData
          .map((e: any) => e.specials)
          .filter(Boolean)
          .map((s: any) => ({ id: s.id, title: s.title }));
        setSpecialContracts(specials);
      } else {
        setSpecialContracts([]);
      }

      // Fetch personal lecture contracts
      const { data: personalData } = await supabase
        .from('personal_entries')
        .select('id, subject, status')
        .eq('user_id', currentUser.id)
        .eq('status', 'contracted') as { data: any[] | null };

      if (personalData && personalData.length > 0) {
        const subjectNames = personalData.map((pe: any) => {
          return subjectsMap.get(pe.subject) || pe.subject;
        });
        setPersonalContractSubjects(subjectNames);
      } else {
        setPersonalContractSubjects([]);
      }
    } catch (err) {
      console.error('Failed to fetch contract data:', err);
      setError(err instanceof Error ? err.message : 'データの取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }, [currentUser, supabase]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [authLoading, currentUser, router, fetchData]);

  const renderMainContract = () => (
    <div className="bg-warm-50 dark:bg-primary-800/50 p-6 rounded-btn shadow-md">
      <h2 className="text-2xl font-bold text-primary-800 dark:text-warm-100 mb-4">本契約</h2>
      {!contract ? (
        <p className="text-warm-600 dark:text-warm-400">現在有効な本契約はありません。</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <p className="text-sm font-medium text-warm-500 dark:text-warm-400">保護者Gmailアドレス</p>
            <p className="mt-1 text-lg font-semibold text-primary-800 dark:text-warm-100">{contract.parent_email || '未設定'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-warm-500 dark:text-warm-400">ステータス</p>
            <p className={`mt-1 text-lg font-semibold ${contract.status === 'active' ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'} capitalize`}>
              {contract.status === 'active' ? '契約中' : '停止中'}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-warm-500 dark:text-warm-400">契約期間</p>
            <p className="mt-1 text-lg text-primary-800 dark:text-warm-100">
              {formatDateForDisplay(contract.current_period_start)} ~ {formatDateForDisplay(contract.current_period_end)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-warm-500 dark:text-warm-400">支払い方法</p>
            <p className="mt-1 text-lg text-primary-800 dark:text-warm-100">{formatPaymentMethod(contract.payment_method)}</p>
          </div>
          <div className="col-span-1 md:col-span-2">
            <p className="text-sm font-medium text-warm-500 dark:text-warm-400">契約更新について</p>
            <p className={`mt-1 text-base ${contract.cancel_at_period_end ? 'text-warning-600 dark:text-warning-400' : 'text-primary-800 dark:text-warm-100'}`}>
              {contract.cancel_at_period_end
                ? `契約期間終了日 (${formatDateForDisplay(contract.current_period_end)}) をもって解約となります。`
                : `契約期間終了日 (${formatDateForDisplay(contract.current_period_end)}) に自動で更新されます。`}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const renderOtherContracts = (title: string, items: string[]) => (
    <div className="bg-warm-50 dark:bg-primary-800/50 p-6 rounded-btn shadow-md">
      <h2 className="text-2xl font-bold text-primary-800 dark:text-warm-100 mb-4">{title}</h2>
      {items.length > 0 ? (
        <ul className="space-y-2 list-disc list-inside">
          {items.map((item, index) => (
            <li key={index} className="text-lg text-primary-800 dark:text-warm-100">{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-warm-600 dark:text-warm-400">現在契約中のものはありません。</p>
      )}
    </div>
  );

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-4xl text-center p-8 animate-fade-in mt-8">
        <div className="spinner mx-auto"></div>
        <p className="text-warm-600 dark:text-warm-300 mt-4">契約情報を読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-lg text-center p-8 bg-danger-100 dark:bg-danger-900/50 rounded-btn animate-fade-in mt-8">
        <h2 className="text-2xl font-bold text-danger-800 dark:text-danger-200">エラー</h2>
        <p className="mt-2 text-danger-600 dark:text-danger-300">{error}</p>
        <Link href="/mypage" className="btn-danger mt-6 inline-block">
          マイページに戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl card p-8 animate-fade-in mt-8">
      <div className="flex justify-between items-center mb-8 border-b dark:border-primary-800 pb-4">
        <h1 className="text-2xl font-bold text-primary-700 dark:text-warm-100 tracking-wider">契約情報</h1>
        <Link href="/mypage" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">&larr; マイページに戻る</Link>
      </div>

      <div className="space-y-8">
        {renderMainContract()}
        {renderOtherContracts('特別講習', specialContracts.map(sc => sc.title))}
        {renderOtherContracts('個別講義', personalContractSubjects)}
      </div>
    </div>
  );
}
