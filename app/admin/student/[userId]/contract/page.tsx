'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

const paymentMethodOptions: Record<string, string> = {
  bank_transfer_lump: '銀行振込　一括',
  bank_transfer_monthly: '銀行振込　月額',
  credit_card_lump: 'クレジット　一括',
  credit_card_monthly: 'クレジット　月額',
};

const statusOptions: Record<string, string> = {
  active: '有効',
  expired: '期限切れ',
  cancelled: 'キャンセル済',
};

type Contract = {
  id: string;
  user_id: string;
  payment_method: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  status: string | null;
  notes: string | null;
};

export default function AdminStudentContractPage() {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [contract, setContract] = useState<Contract | null>(null);
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [paymentMethod, setPaymentMethod] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (authLoading || !currentUser || !userId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch student name
        const { data: user } = await (supabase.from('users') as any)
          .select('nickname')
          .eq('id', userId)
          .single();
        setStudentName(user?.nickname || '名前未設定');

        // Fetch contract
        const { data: contractData } = await (supabase.from('contracts') as any)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (contractData) {
          const c = contractData as Contract;
          setContract(c);
          setPaymentMethod(c.payment_method || '');
          setStartDate(c.contract_start_date || '');
          setEndDate(c.contract_end_date || '');
          setStatus(c.status || 'active');
          setNotes(c.notes || '');
        }
      } catch (err) {
        console.error('Error fetching contract:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, currentUser, authLoading]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const contractData = {
        user_id: userId,
        payment_method: paymentMethod || null,
        contract_start_date: startDate || null,
        contract_end_date: endDate || null,
        status,
        notes: notes || null,
      };

      if (contract?.id) {
        // Update existing
        const { error } = await (supabase.from('contracts') as any)
          .update(contractData)
          .eq('id', contract.id);
        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await (supabase.from('contracts') as any)
          .insert(contractData)
          .select()
          .single();
        if (error) throw error;
        setContract(data as Contract);
      }
      alert('契約情報を保存しました。');
    } catch (err) {
      console.error('Error saving contract:', err);
      alert('保存に失敗しました。');
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
      {/* Breadcrumbs */}
      <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4 gap-2">
        <Link href="/admin/students" className="hover:text-blue-600 dark:hover:text-blue-400">生徒一覧</Link>
        <span>/</span>
        <Link href={`/admin/student/${userId}`} className="hover:text-blue-600 dark:hover:text-blue-400">{studentName}</Link>
        <span>/</span>
        <span className="text-gray-800 dark:text-white font-medium">契約情報</span>
      </nav>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">契約情報</h1>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">支払い方法</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                <option value="">未設定</option>
                {Object.entries(paymentMethodOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ステータス</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                {Object.entries(statusOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">契約開始日</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">契約終了日</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md" />
            </div>
          </div>

          {/* Contract Period Status */}
          {startDate && endDate && (
            <div className={`p-4 rounded-lg ${
              new Date(endDate) < new Date()
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            }`}>
              <p className={`text-sm font-medium ${
                new Date(endDate) < new Date() ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'
              }`}>
                {new Date(endDate) < new Date()
                  ? '契約期間は終了しています。'
                  : `契約期間中（残り ${Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} 日）`
                }
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">備考</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md" placeholder="契約に関するメモ..." />
          </div>

          <div className="flex justify-end pt-4 border-t dark:border-gray-700">
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-colors disabled:bg-gray-400">
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
