'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type ClassItem = {
  id: string;
  title: string;
  instructor_name: string;
  passcode: string;
  start_time: string;
  end_time: string;
};

type InstructorInfo = {
  id: string;
  display_name: string;
};

// PasscodeModal Component
interface PasscodeModalProps {
  classTitle: string;
  onClose: () => void;
  onSubmit: (passcode: string, instructorName: string, studyMaterial: string) => Promise<void>;
  isSubmitting: boolean;
  error: string;
}

const PasscodeModal: React.FC<PasscodeModalProps> = ({ classTitle, onClose, onSubmit, isSubmitting, error }) => {
  const [passcode, setPasscode] = useState('');
  const [instructorName, setInstructorName] = useState('');
  const [studyMaterial, setStudyMaterial] = useState('');
  const [instructors, setInstructors] = useState<InstructorInfo[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(true);

  useEffect(() => {
    const fetchInstructors = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('users')
          .select('id, display_name')
          .in('role', ['admin', 'super']);
        if (error) throw error;
        const list = (data || []).map((u: any) => ({
          id: u.id,
          display_name: u.display_name || '不明な講師',
        }));
        setInstructors(list.sort((a: InstructorInfo, b: InstructorInfo) => a.display_name.localeCompare(b.display_name)));
      } catch (err) {
        console.error('Failed to fetch instructors:', err);
      } finally {
        setLoadingInstructors(false);
      }
    };
    fetchInstructors();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instructorName) {
      alert('担当講師を選択してください。');
      return;
    }
    if (!studyMaterial.trim()) {
      alert('取り組む教材名を入力してください。');
      return;
    }
    onSubmit(passcode, instructorName, studyMaterial.trim());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm animate-fade-in max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-2 text-gray-800 dark:text-white">出席登録</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{classTitle}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">パスコード (4桁)</label>
            <input
              type="tel"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))}
              maxLength={4}
              className="w-full p-3 text-center text-2xl font-mono tracking-widest border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
              placeholder="----"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">担当講師</label>
            <select
              value={instructorName}
              onChange={(e) => setInstructorName(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-sm dark:text-white"
              required
              disabled={loadingInstructors}
            >
              <option value="">-- 講師を選択 --</option>
              {instructors.map(inst => (
                <option key={inst.id} value={inst.display_name}>{inst.display_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">取り組む教材名</label>
            <input
              type="text"
              value={studyMaterial}
              onChange={(e) => setStudyMaterial(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-sm dark:text-white"
              placeholder="例: ターゲット1900、青チャートなど"
              required
            />
          </div>

          {error && <p className="text-sm text-red-500 text-center mt-3">{error}</p>}

          <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700 mt-2">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 bg-gray-200 dark:bg-gray-500 rounded-md text-sm">キャンセル</button>
            <button type="submit" disabled={isSubmitting || passcode.length !== 4 || !instructorName || !studyMaterial.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:bg-gray-400 font-bold">
              {isSubmitting ? '送信中...' : '出席する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Page Component
export default function ClassesPage() {
  const { currentUser } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [attendedClassIds, setAttendedClassIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const now = new Date().toISOString();

      // Fetch classes that have not ended yet, ordered by start time
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, title, instructor_name, passcode, start_time, end_time')
        .gt('end_time', now)
        .order('start_time', { ascending: true });

      if (classesError) throw classesError;
      setClasses(classesData || []);

      // Fetch attendance records for the current user
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('class_id')
        .eq('user_id', currentUser.id);

      if (attendanceError) throw attendanceError;
      const attendedIds = new Set<string>((attendanceData || []).map((r: any) => r.class_id));
      setAttendedClassIds(attendedIds);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('データの取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClassClick = (classItem: ClassItem) => {
    const now = new Date();
    const startTime = new Date(classItem.start_time);
    const isOngoing = startTime <= now;

    if (attendedClassIds.has(classItem.id) || !isOngoing) {
      return;
    }
    setSelectedClass(classItem);
    setIsModalOpen(true);
    setModalError('');
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedClass(null);
  };

  const handlePasscodeSubmit = async (passcode: string, instructorName: string, studyMaterial: string) => {
    if (!selectedClass || !currentUser) return;

    setIsSubmitting(true);
    setModalError('');

    if (passcode === selectedClass.passcode) {
      try {
        const supabase = createClient();
        const { error } = await (supabase.from('attendance_records') as any).insert({
          class_id: selectedClass.id,
          user_id: currentUser.id,
          student_name: currentUser.displayName || 'Unknown Student',
          instructor_name: instructorName,
          study_material: studyMaterial,
          attended_at: new Date().toISOString(),
        });
        if (error) throw error;

        setAttendedClassIds(prev => new Set(prev).add(selectedClass.id));
        handleModalClose();
      } catch (err) {
        console.error('Error recording attendance:', err);
        setModalError('出席の記録中にエラーが発生しました。');
      }
    } else {
      setModalError('パスコードが間違っています。');
    }

    setIsSubmitting(false);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-dashed rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">読み込み中...</p>
        </div>
      );
    }
    if (error) {
      return <div className="text-center text-red-500 py-12">{error}</div>;
    }
    if (classes.length === 0) {
      return <div className="text-center text-gray-500 dark:text-gray-400 py-12">現在参加できる講義はありません。</div>;
    }
    return (
      <div className="space-y-4">
        {classes.map(cls => {
          const isAttended = attendedClassIds.has(cls.id);
          const now = new Date();
          const startTime = new Date(cls.start_time);
          const endTime = new Date(cls.end_time);
          const isOngoing = startTime <= now;

          let statusInfo;
          if (isAttended) {
            statusInfo = { text: '出席中', style: 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100' };
          } else if (isOngoing) {
            statusInfo = { text: '開講中', style: 'bg-rose-200 text-rose-800 dark:bg-rose-700 dark:text-rose-100 animate-pulse' };
          } else {
            statusInfo = { text: '開講予定', style: 'bg-sky-200 text-sky-800 dark:bg-sky-700 dark:text-sky-100' };
          }

          const isClickable = !isAttended && isOngoing;

          return (
            <div
              key={cls.id}
              onClick={() => handleClassClick(cls)}
              className={`bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg flex justify-between items-center transition-all duration-200 ${
                isClickable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-md' : 'opacity-70 cursor-not-allowed'
              }`}
              aria-disabled={!isClickable}
            >
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">{cls.title}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">講師: {cls.instructor_name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {startTime.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} - {endTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex-shrink-0 ml-4">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusInfo.style}`}>
                  {statusInfo.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 animate-fade-in mt-8">
        <div className="border-b dark:border-gray-700 pb-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">講義に出席する</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">出席したい講義を選択して、担当講師から伝えられた4桁のパスコードを入力してください。</p>
        </div>
        {renderContent()}
      </div>
      {isModalOpen && selectedClass && (
        <PasscodeModal
          classTitle={selectedClass.title}
          onClose={handleModalClose}
          onSubmit={handlePasscodeSubmit}
          isSubmitting={isSubmitting}
          error={modalError}
        />
      )}
    </>
  );
}
