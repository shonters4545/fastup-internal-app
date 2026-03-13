'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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

type SubjectOption = {
  id: string;
  name: string;
};

type BookOption = {
  id: string;
  name: string;
  subject_id: string;
};

type RoomInfo = {
  id: string;
  label: string;
  room_type: string;
  instructor_name: string | null;
};

// --- PasscodeModal (改修版) ---
interface PasscodeModalProps {
  classItem: ClassItem;
  userId: string;
  userName: string;
  onClose: () => void;
  onSuccess: () => void;
}

type RegistrationResult = {
  roomLabel: string;
  roomType: string;
  instructorName: string | null;
  bookName: string;
};

const PasscodeModal: React.FC<PasscodeModalProps> = ({ classItem, userId, userName, onClose, onSuccess }) => {
  const [passcode, setPasscode] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [isTrial, setIsTrial] = useState(false);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [allBooks, setAllBooks] = useState<BookOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showBookDropdown, setShowBookDropdown] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<RegistrationResult | null>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 理系科目名
  const SCIENCE_SUBJECTS = ['数学', '物理', '化学', '生物'];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient();
        const [subjectsRes, booksRes] = await Promise.all([
          supabase.from('subjects').select('id, name').order('display_order'),
          supabase.from('books').select('id, name, subject_id').order('display_order'),
        ]);
        if (subjectsRes.data) setSubjects(subjectsRes.data as SubjectOption[]);
        if (booksRes.data) setAllBooks(booksRes.data as BookOption[]);
      } catch (err) {
        console.error('Failed to fetch subjects/books:', err);
      }
    };
    fetchData();
  }, []);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          bookInputRef.current && !bookInputRef.current.contains(e.target as Node)) {
        setShowBookDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 科目でフィルタされた教材リスト + 検索フィルタ
  const filteredBooks = allBooks.filter(b => {
    if (selectedSubjectId && b.subject_id !== selectedSubjectId) return false;
    if (bookSearchQuery.trim()) {
      return b.name.toLowerCase().includes(bookSearchQuery.toLowerCase());
    }
    return true;
  });

  const selectedBookName = allBooks.find(b => b.id === selectedBookId)?.name || '';

  const handleBookSelect = (book: BookOption) => {
    setSelectedBookId(book.id);
    setBookSearchQuery(book.name);
    setShowBookDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId) {
      setError('科目を選択してください。');
      return;
    }
    if (!selectedBookId) {
      setError('教材を選択してください。');
      return;
    }

    setIsSubmitting(true);
    setError('');

    // パスコード検証
    if (passcode !== classItem.passcode) {
      setError('パスコードが間違っています。');
      setIsSubmitting(false);
      return;
    }

    try {
      const supabase = createClient();
      const selectedSubject = subjects.find(s => s.id === selectedSubjectId);
      const isScienceSubject = selectedSubject ? SCIENCE_SUBJECTS.includes(selectedSubject.name) : false;

      // 出席予定があるか確認
      const classDate = new Date(classItem.start_time).toISOString().split('T')[0];
      const { data: planData } = await (supabase.from('attendance_plans') as any)
        .select('id')
        .eq('user_id', userId)
        .eq('date', classDate)
        .eq('planned', true)
        .limit(1);

      const hasAttendancePlan = planData && planData.length > 0;

      // ルーム振り分け
      let assignedRoomId: string | null = null;
      let assignedRoomLabel = '';
      let assignedRoomType = '';
      let assignedInstructorName: string | null = null;

      // この特訓のルームを取得
      const { data: rooms } = await (supabase.from('class_rooms') as any)
        .select('id, label, room_type, instructor_name')
        .eq('class_id', classItem.id)
        .order('label');

      if (rooms && rooms.length > 0) {
        if (!hasAttendancePlan) {
          // 出席予定未提出 → Zルーム
          const zRoom = rooms.find((r: RoomInfo) => r.label === 'Z');
          if (zRoom) {
            assignedRoomId = zRoom.id;
            assignedRoomLabel = 'Z';
            assignedRoomType = 'unplanned';
            assignedInstructorName = zRoom.instructor_name;
          }
        } else {
          // 科目の文理で振り分け
          const targetType = isScienceSubject ? 'science' : 'humanities';
          // 対象タイプのルームから、空きがある順に探す
          const targetRooms = rooms.filter((r: RoomInfo) => r.room_type === targetType);

          if (targetRooms.length > 0) {
            // 各ルームの現在の参加者数を取得
            const roomIds = targetRooms.map((r: RoomInfo) => r.id);
            const { data: roomAttendance } = await (supabase.from('attendance_records') as any)
              .select('room_id')
              .eq('class_id', classItem.id)
              .in('room_id', roomIds);

            const roomCounts = new Map<string, number>();
            (roomAttendance || []).forEach((a: any) => {
              roomCounts.set(a.room_id, (roomCounts.get(a.room_id) || 0) + 1);
            });

            // 空きのあるルームを探す（定員10名）
            for (const room of targetRooms) {
              const count = roomCounts.get(room.id) || 0;
              if (count < 10) {
                assignedRoomId = room.id;
                assignedRoomLabel = room.label;
                assignedRoomType = room.room_type;
                assignedInstructorName = room.instructor_name;
                break;
              }
            }
            // 全て満員の場合は最初のルームに入れる
            if (!assignedRoomId && targetRooms.length > 0) {
              assignedRoomId = targetRooms[0].id;
              assignedRoomLabel = targetRooms[0].label;
              assignedRoomType = targetRooms[0].room_type;
              assignedInstructorName = targetRooms[0].instructor_name;
            }
          }
        }
      }

      // 出席記録を挿入
      const { error: insertError } = await (supabase.from('attendance_records') as any).insert({
        class_id: classItem.id,
        user_id: userId,
        student_name: userName,
        instructor_name: assignedInstructorName,
        study_material: selectedBookName,
        subject_id: selectedSubjectId,
        book_id: selectedBookId,
        room_id: assignedRoomId,
        is_trial: isTrial,
        attended_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      // 振り分け結果を表示
      if (assignedRoomLabel) {
        setRegistrationResult({
          roomLabel: assignedRoomLabel,
          roomType: assignedRoomType,
          instructorName: assignedInstructorName,
          bookName: selectedBookName,
        });
      } else {
        onSuccess();
      }
    } catch (err) {
      console.error('Error recording attendance:', err);
      setError('出席の記録中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResultClose = () => {
    setRegistrationResult(null);
    onSuccess();
  };

  // 登録完了・振り分け結果画面
  if (registrationResult) {
    const { roomLabel, roomType, instructorName, bookName } = registrationResult;
    const isZRoom = roomLabel === 'Z';
    const roomTypeLabel = roomType === 'science' ? '理系' : roomType === 'humanities' ? '文系' : '';

    return (
      <div className="modal-overlay" onClick={handleResultClose}>
        <div className="modal-content p-6 w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
          <div className="text-center">
            <div className="text-4xl mb-3">{isZRoom ? '⏳' : '✅'}</div>
            <h3 className="text-lg font-bold text-primary-800 dark:text-warm-100 mb-4">
              {isZRoom ? '出席登録完了' : '出席登録完了'}
            </h3>
          </div>

          <div className="space-y-3 mb-6">
            {/* 教室 */}
            <div className="bg-primary-50 dark:bg-primary-900/30 rounded-btn p-4 text-center">
              <p className="text-xs text-warm-500 dark:text-warm-400 mb-1">あなたの教室</p>
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                教室{roomLabel}
              </p>
              {roomTypeLabel && (
                <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-badge ${
                  roomType === 'science' ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300' : 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                }`}>{roomTypeLabel}</span>
              )}
            </div>

            {/* 担当講師 */}
            <div className="bg-warm-50 dark:bg-primary-800/50 rounded-btn p-3 flex items-center justify-between">
              <span className="text-xs text-warm-500 dark:text-warm-400">担当講師</span>
              <span className="text-sm font-bold text-primary-800 dark:text-warm-100">
                {isZRoom ? '未定' : (instructorName || '未定')}
              </span>
            </div>

            {/* 教材 */}
            <div className="bg-warm-50 dark:bg-primary-800/50 rounded-btn p-3 flex items-center justify-between">
              <span className="text-xs text-warm-500 dark:text-warm-400">教材</span>
              <span className="text-sm font-bold text-primary-800 dark:text-warm-100 truncate ml-2">{bookName}</span>
            </div>

            {isZRoom && (
              <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-btn p-3">
                <p className="text-xs text-warning-700 dark:text-warning-300">
                  出席予定が未提出のため、グループには振り分けられていません。教室Zでお待ちください。
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleResultClose}
            className="btn-primary w-full py-3"
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-6 w-full max-w-sm animate-fade-in max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-2 text-primary-800 dark:text-warm-100">出席登録</h3>
        <p className="text-sm text-warm-600 dark:text-warm-400 mb-6">{classItem.title}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* パスコード */}
          <div>
            <label className="label uppercase">パスコード (4桁)</label>
            <input
              type="tel"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))}
              maxLength={4}
              className="input w-full p-3 text-center text-2xl font-mono tracking-widest"
              placeholder="----"
              autoFocus
              required
            />
          </div>

          {/* 科目選択 */}
          <div>
            <label className="label uppercase">当日やる科目</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setSelectedBookId('');
                setBookSearchQuery('');
              }}
              className="input w-full p-2 text-sm"
              required
            >
              <option value="">-- 科目を選択 --</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* 教材名（リッチ選択） */}
          <div className="relative">
            <label className="label uppercase">教材名</label>
            <input
              ref={bookInputRef}
              type="text"
              value={bookSearchQuery}
              onChange={(e) => {
                setBookSearchQuery(e.target.value);
                setSelectedBookId('');
                setShowBookDropdown(true);
              }}
              onFocus={() => setShowBookDropdown(true)}
              className="input w-full p-2 text-sm"
              placeholder={selectedSubjectId ? '教材名を入力して検索...' : '先に科目を選択してください'}
              disabled={!selectedSubjectId}
              required
            />
            {showBookDropdown && selectedSubjectId && (
              <div
                ref={dropdownRef}
                className="absolute z-10 w-full mt-1 bg-white dark:bg-primary-800 border border-warm-300 dark:border-primary-700 rounded-input shadow-lg max-h-48 overflow-y-auto"
              >
                {filteredBooks.length === 0 ? (
                  <div className="p-3 text-sm text-warm-400">該当する教材がありません</div>
                ) : (
                  filteredBooks.map(book => (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => handleBookSelect(book)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-700 transition-colors ${
                        selectedBookId === book.id ? 'bg-primary-100 dark:bg-primary-900/30 font-bold' : 'text-primary-800 dark:text-warm-200'
                      }`}
                    >
                      {book.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 体験チェックボックス */}
          <div className="flex items-center gap-2 p-3 bg-warning-50 dark:bg-warning-900/20 rounded-input border border-warning-200 dark:border-warning-800">
            <input
              type="checkbox"
              id="is-trial"
              checked={isTrial}
              onChange={(e) => setIsTrial(e.target.checked)}
              className="h-4 w-4 rounded border-warm-300 text-warning-600 focus:ring-warning-500"
            />
            <label htmlFor="is-trial" className="text-sm text-warning-800 dark:text-warning-200 font-medium">
              体験参加です
            </label>
          </div>

          {error && <p className="text-sm text-danger-500 text-center mt-3">{error}</p>}

          <div className="flex justify-end gap-2 pt-4 border-t dark:border-primary-800 mt-2">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="btn-secondary px-4 py-2 text-sm">キャンセル</button>
            <button
              type="submit"
              disabled={isSubmitting || passcode.length !== 4 || !selectedSubjectId || !selectedBookId}
              className="btn-primary px-4 py-2 text-sm disabled:bg-warm-400"
            >
              {isSubmitting ? '送信中...' : '出席する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- 出席済み詳細モーダル ---
type AttendanceRoomDetail = {
  label: string;
  room_type: string;
  instructor_name: string | null;
};

interface AttendanceDetailModalProps {
  classItem: ClassItem;
  roomDetail: AttendanceRoomDetail | null;
  onClose: () => void;
}

const AttendanceDetailModal: React.FC<AttendanceDetailModalProps> = ({ classItem, roomDetail, onClose }) => {
  const isZRoom = roomDetail?.label === 'Z';
  const roomTypeLabel = roomDetail?.room_type === 'science' ? '理系' : roomDetail?.room_type === 'humanities' ? '文系' : '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-6 w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-2 text-primary-800 dark:text-warm-100">出席情報</h3>
        <p className="text-sm text-warm-600 dark:text-warm-400 mb-4">{classItem.title}</p>
        {roomDetail ? (
          <div className="space-y-3">
            {/* 教室 */}
            <div className="bg-primary-50 dark:bg-primary-900/30 rounded-btn p-4 text-center">
              <p className="text-xs text-warm-500 dark:text-warm-400 mb-1">あなたの教室</p>
              <p className="text-4xl font-bold text-primary-600 dark:text-primary-400">
                教室{roomDetail.label}
              </p>
              {roomTypeLabel && (
                <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-badge ${
                  roomDetail.room_type === 'science' ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300' : 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                }`}>{roomTypeLabel}</span>
              )}
            </div>

            {/* 担当講師 */}
            <div className="bg-warm-50 dark:bg-primary-800/50 rounded-btn p-3 flex items-center justify-between">
              <span className="text-xs text-warm-500 dark:text-warm-400">担当講師</span>
              <span className="text-sm font-bold text-primary-800 dark:text-warm-100">
                {isZRoom ? '未定' : (roomDetail.instructor_name || '未定')}
              </span>
            </div>

            {isZRoom && (
              <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-btn p-3">
                <p className="text-xs text-warning-700 dark:text-warning-300">
                  出席予定が未提出のため、グループには振り分けられていません。教室Zでお待ちください。
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-success-600 dark:text-success-400 font-bold">出席登録済みです</p>
          </div>
        )}
        <div className="flex justify-end pt-4 border-t dark:border-primary-800 mt-4">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm">閉じる</button>
        </div>
      </div>
    </div>
  );
};

// --- Main Page ---
export default function ClassesPage() {
  const { currentUser } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [attendedClassIds, setAttendedClassIds] = useState<Set<string>>(new Set());
  const [attendanceRoomDetails, setAttendanceRoomDetails] = useState<Map<string, AttendanceRoomDetail | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const now = new Date().toISOString();

      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, title, instructor_name, passcode, start_time, end_time')
        .gt('end_time', now)
        .order('start_time', { ascending: true });

      if (classesError) throw classesError;
      setClasses(classesData || []);

      // 出席レコードとルーム情報を取得
      const { data: attendanceData, error: attendanceError } = await (supabase.from('attendance_records') as any)
        .select('class_id, room_id')
        .eq('user_id', currentUser.id);

      if (attendanceError) throw attendanceError;
      const attendedIds = new Set<string>((attendanceData || []).map((r: any) => r.class_id));
      setAttendedClassIds(attendedIds);

      // ルーム詳細を取得
      const roomIds = (attendanceData || []).filter((r: any) => r.room_id).map((r: any) => r.room_id);
      const detailMap = new Map<string, AttendanceRoomDetail | null>();
      if (roomIds.length > 0) {
        const { data: roomsData } = await (supabase.from('class_rooms') as any)
          .select('id, label, room_type, instructor_name')
          .in('id', roomIds);
        const roomMap = new Map<string, AttendanceRoomDetail>();
        (roomsData || []).forEach((r: any) => roomMap.set(r.id, { label: r.label, room_type: r.room_type, instructor_name: r.instructor_name }));
        (attendanceData || []).forEach((r: any) => {
          detailMap.set(r.class_id, r.room_id ? (roomMap.get(r.room_id) || null) : null);
        });
      }
      setAttendanceRoomDetails(detailMap);
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

    if (attendedClassIds.has(classItem.id)) {
      // 出席済み → 詳細表示
      setSelectedClass(classItem);
      setIsDetailModalOpen(true);
      return;
    }
    if (!isOngoing) return;

    setSelectedClass(classItem);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setIsDetailModalOpen(false);
    setSelectedClass(null);
  };

  const handleAttendanceSuccess = () => {
    handleModalClose();
    fetchData();
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-warm-500 dark:text-warm-400">読み込み中...</p>
        </div>
      );
    }
    if (error) {
      return <div className="text-center text-danger-500 py-12">{error}</div>;
    }
    if (classes.length === 0) {
      return <div className="text-center text-warm-500 dark:text-warm-400 py-12">現在参加できる講義はありません。</div>;
    }
    return (
      <div className="space-y-4">
        {classes.map(cls => {
          const isAttended = attendedClassIds.has(cls.id);
          const now = new Date();
          const startTime = new Date(cls.start_time);
          const isOngoing = startTime <= now;

          let statusInfo;
          if (isAttended) {
            const roomDetail = attendanceRoomDetails.get(cls.id);
            const roomText = roomDetail ? (roomDetail.label === 'Z' ? '待機中' : `教室${roomDetail.label}`) : '';
            statusInfo = { text: `出席中${roomText ? ` (${roomText})` : ''}`, style: 'bg-success-200 text-success-800 dark:bg-success-700 dark:text-success-100' };
          } else if (isOngoing) {
            statusInfo = { text: '開講中', style: 'bg-danger-200 text-danger-800 dark:bg-danger-700 dark:text-danger-100 animate-pulse' };
          } else {
            statusInfo = { text: '開講予定', style: 'bg-info-200 text-info-800 dark:bg-info-700 dark:text-info-100' };
          }

          const isClickable = isOngoing || isAttended;

          return (
            <div
              key={cls.id}
              onClick={() => handleClassClick(cls)}
              className={`bg-warm-50 dark:bg-primary-800/50 p-4 rounded-btn flex justify-between items-center transition-all duration-200 ${
                isClickable ? 'cursor-pointer hover:bg-warm-50 dark:hover:bg-primary-800 hover:shadow-md' : 'opacity-70 cursor-not-allowed'
              }`}
              aria-disabled={!isClickable}
            >
              <div>
                <h2 className="text-lg font-bold text-primary-800 dark:text-warm-100">{cls.title}</h2>
                <p className="text-sm text-warm-600 dark:text-warm-400 mt-1">講師: {cls.instructor_name}</p>
                <p className="text-sm text-warm-500 dark:text-warm-400">
                  {startTime.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} - {new Date(cls.end_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex-shrink-0 ml-4 flex flex-col items-end gap-1">
                <span className={`text-xs font-semibold px-3 py-1 rounded-badge ${statusInfo.style}`}>
                  {statusInfo.text}
                </span>
                {isAttended && (
                  <span className="text-[10px] text-primary-500 dark:text-primary-400">タップで詳細</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="w-full max-w-4xl card p-8 animate-fade-in mt-8">
        <div className="border-b dark:border-primary-800 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-primary-700 dark:text-warm-100 tracking-wider">講義に出席する</h1>
          <p className="mt-2 text-sm text-warm-600 dark:text-warm-400">出席したい講義を選択して、4桁のパスコードと科目・教材を入力してください。</p>
        </div>
        {renderContent()}
      </div>
      {isModalOpen && selectedClass && currentUser && (
        <PasscodeModal
          classItem={selectedClass}
          userId={currentUser.id}
          userName={currentUser.displayName || 'Unknown Student'}
          onClose={handleModalClose}
          onSuccess={handleAttendanceSuccess}
        />
      )}
      {isDetailModalOpen && selectedClass && (
        <AttendanceDetailModal
          classItem={selectedClass}
          roomDetail={attendanceRoomDetails.get(selectedClass.id) || null}
          onClose={handleModalClose}
        />
      )}
    </>
  );
}
