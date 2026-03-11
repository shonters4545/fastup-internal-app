'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import TestScoreModal from '@/components/TestScoreModal';
import AddCustomBookModal from '@/components/AddCustomBookModal';
import type { Database } from '@/lib/types/database';

type Subject = Database['public']['Tables']['subjects']['Row'];
type Division = Database['public']['Tables']['divisions']['Row'];
type Book = Database['public']['Tables']['books']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];
type ProgressRow = Database['public']['Tables']['progress']['Row'];

export default function CurriculumsPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const supabase = createClient();

  // Data State
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userProgress, setUserProgress] = useState<Map<string, ProgressRow>>(new Map());

  // UI State
  const [loading, setLoading] = useState(true);
  const [expandedBookIds, setExpandedBookIds] = useState<Set<string>>(new Set());
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);

  // Modal State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [pendingCompletion, setPendingCompletion] = useState<{ taskId: string; bookId: string; lap: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Book Modal
  const [isAddCustomBookModalOpen, setIsAddCustomBookModalOpen] = useState(false);
  const [targetDivisionId, setTargetDivisionId] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';
  const userId = currentUser?.id;

  const fetchData = useCallback(async () => {
    if (!userId || !currentUser?.authId) return;
    try {
      // Fetch user's subjects
      const { data: userSubjects } = await (supabase.from('user_subjects') as any)
        .select('subject_id')
        .eq('user_id', userId);
      const userSubjectIds = ((userSubjects || []) as any[]).map((us: any) => us.subject_id);

      // Fetch master data in parallel
      const [subjectsRes, divisionsRes, masterBooksRes, tasksRes, progressRes] = await Promise.all([
        supabase.from('subjects').select('*').order('display_order'),
        supabase.from('divisions').select('*').order('display_order'),
        (supabase.from('books') as any).select('*').eq('is_custom', false).order('display_order'),
        supabase.from('tasks').select('*').order('display_order'),
        (supabase.from('progress') as any).select('*').eq('user_id', userId),
      ]);

      // Fetch custom books for this user
      const { data: customBooks } = await (supabase.from('books') as any)
        .select('*')
        .eq('is_custom', true)
        .eq('user_id', userId);

      // Filter subjects by user enrollment
      const allSubjects = (subjectsRes.data || []) as Subject[];
      const filteredSubjects = userSubjectIds.length > 0
        ? allSubjects.filter(s => userSubjectIds.includes(s.id))
        : allSubjects;
      setSubjects(filteredSubjects);
      if (filteredSubjects.length > 0 && !activeSubjectId) {
        setActiveSubjectId(filteredSubjects[0].id);
      }

      setDivisions((divisionsRes.data || []) as Division[]);
      setBooks([...((masterBooksRes.data || []) as Book[]), ...((customBooks || []) as Book[])]);
      setTasks((tasksRes.data || []) as Task[]);

      // Build progress map keyed by "taskId_lap"
      const progressMap = new Map<string, ProgressRow>();
      ((progressRes.data || []) as ProgressRow[]).forEach(p => {
        const key = `${p.task_id}_${p.lap}`;
        progressMap.set(key, p);
      });
      setUserProgress(progressMap);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('データの読み込みに失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [userId, currentUser?.authId]);

  useEffect(() => {
    if (!authLoading && userId) fetchData();
  }, [authLoading, userId, fetchData]);

  // Processed data for rendering
  const processedData = useMemo(() => {
    const booksByDivision = new Map<string, Book[]>();
    books.forEach(book => {
      const list = booksByDivision.get(book.division_id) || [];
      list.push(book);
      booksByDivision.set(book.division_id, list);
    });
    // Sort: custom first, then by display_order
    booksByDivision.forEach(list => {
      list.sort((a, b) => {
        if (a.is_custom && !b.is_custom) return -1;
        if (!a.is_custom && b.is_custom) return 1;
        return a.display_order - b.display_order;
      });
    });

    const tasksByBook = new Map<string, Task[]>();
    tasks.forEach(task => {
      const list = tasksByBook.get(task.book_id) || [];
      list.push(task);
      tasksByBook.set(task.book_id, list);
    });
    tasksByBook.forEach(list => list.sort((a, b) => a.display_order - b.display_order));

    return { booksByDivision, tasksByBook };
  }, [books, tasks]);

  // Helpers
  const isLapCompleted = useCallback((bookId: string, lap: number) => {
    const bookTasks = processedData.tasksByBook.get(bookId) || [];
    if (bookTasks.length === 0) return false;
    return bookTasks.every(task => {
      const key = `${task.id}_${lap}`;
      const p = userProgress.get(key);
      return p && p.status === 'completed';
    });
  }, [processedData.tasksByBook, userProgress]);

  const calculateBookProgress = useCallback((book: Book) => {
    const bookTasks = processedData.tasksByBook.get(book.id) || [];
    if (bookTasks.length === 0) return 0;
    const maxLaps = book.max_laps || 1;
    const totalSteps = bookTasks.length * maxLaps;
    let completedSteps = 0;
    for (let lap = 1; lap <= maxLaps; lap++) {
      bookTasks.forEach(task => {
        const key = `${task.id}_${lap}`;
        const p = userProgress.get(key);
        if (p && p.status === 'completed') completedSteps++;
      });
    }
    return Math.round((completedSteps / totalSteps) * 100);
  }, [processedData.tasksByBook, userProgress]);

  const calculateBookAverageScore = useCallback((book: Book) => {
    const bookTasks = processedData.tasksByBook.get(book.id) || [];
    if (bookTasks.length === 0) return null;
    const maxLaps = book.max_laps || 1;
    let totalScore = 0;
    let scoreCount = 0;
    for (let lap = 1; lap <= maxLaps; lap++) {
      bookTasks.forEach(task => {
        const key = `${task.id}_${lap}`;
        const p = userProgress.get(key);
        if (p && p.score !== null) {
          totalScore += p.score;
          scoreCount++;
        }
      });
    }
    return scoreCount === 0 ? null : Math.round((totalScore / scoreCount) * 10) / 10;
  }, [processedData.tasksByBook, userProgress]);

  const subjectProgress = useMemo(() => {
    if (!activeSubjectId) return { completed: 0, total: 0, percentage: 0 };
    const targetDivisions = divisions.filter(d => d.subject_id === activeSubjectId);
    let totalSteps = 0;
    let completedSteps = 0;
    targetDivisions.forEach(division => {
      const divisionBooks = processedData.booksByDivision.get(division.id) || [];
      divisionBooks.forEach(book => {
        const bookTasks = processedData.tasksByBook.get(book.id) || [];
        const maxLaps = book.max_laps || 1;
        totalSteps += bookTasks.length * maxLaps;
        for (let lap = 1; lap <= maxLaps; lap++) {
          bookTasks.forEach(task => {
            const key = `${task.id}_${lap}`;
            const p = userProgress.get(key);
            if (p && p.status === 'completed') completedSteps++;
          });
        }
      });
    });
    const percentage = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);
    return { completed: completedSteps, total: totalSteps, percentage };
  }, [activeSubjectId, divisions, processedData, userProgress]);

  // Handlers
  const toggleBookExpansion = (bookId: string) => {
    setExpandedBookIds(prev => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  };

  const saveProgress = async (taskId: string, bookId: string, lap: number, score: number | null, isSkipped: boolean) => {
    if (!userId) return;
    try {
      const insertData = {
        user_id: userId,
        task_id: taskId,
        book_id: bookId,
        lap,
        status: 'completed',
        score: isSkipped ? null : score,
      };
      const { data, error } = await (supabase.from('progress') as any)
        .upsert(insertData, { onConflict: 'user_id,task_id,lap' })
        .select()
        .single();
      if (error) throw error;

      setUserProgress(prev => {
        const next = new Map(prev);
        next.set(`${taskId}_${lap}`, data);
        return next;
      });
    } catch (error) {
      console.error('Error saving progress:', error);
      alert('保存に失敗しました。');
    }
  };

  const deleteProgress = async (taskId: string, lap: number) => {
    if (!userId) return;
    try {
      const { error } = await (supabase.from('progress') as any)
        .delete()
        .eq('user_id', userId)
        .eq('task_id', taskId)
        .eq('lap', lap);
      if (error) throw error;

      setUserProgress(prev => {
        const next = new Map(prev);
        next.delete(`${taskId}_${lap}`);
        return next;
      });
    } catch (error) {
      console.error('Error deleting progress:', error);
      alert('削除に失敗しました。');
    }
  };

  const handleCheckboxClick = async (task: Task, book: Book, lap: number, isChecked: boolean) => {
    if (isChecked) {
      if (window.confirm(isAdmin ? 'このタスクを未完了に戻しますか？' : 'チェックを外すと、ミニ模試の点数も削除されますがよろしいですか？')) {
        await deleteProgress(task.id, lap);
      }
    } else {
      if (isAdmin || book.is_custom) {
        await saveProgress(task.id, book.id, lap, null, false);
      } else {
        setPendingCompletion({ taskId: task.id, bookId: book.id, lap });
        setIsTestModalOpen(true);
      }
    }
  };

  const handleModalSubmit = async (score: number | null, isSkipped: boolean) => {
    if (!pendingCompletion) return;
    setIsSubmitting(true);
    try {
      await saveProgress(pendingCompletion.taskId, pendingCompletion.bookId, pendingCompletion.lap, score, isSkipped);
      setIsTestModalOpen(false);
      setPendingCompletion(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomBook = async (bookId: string) => {
    if (!userId || !window.confirm('このカスタム参考書を削除しますか？\n（関連するタスクと進捗も削除されます）')) return;
    try {
      // Delete tasks first (FK constraint)
      await (supabase.from('tasks') as any).delete().eq('book_id', bookId);
      // Delete progress for tasks in this book
      await (supabase.from('progress') as any).delete().eq('book_id', bookId).eq('user_id', userId);
      // Delete the book
      await (supabase.from('books') as any).delete().eq('id', bookId);
      alert('削除しました');
      fetchData();
    } catch (error) {
      console.error('Error deleting custom book:', error);
      alert('削除に失敗しました');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="w-16 h-16 border-4 border-blue-500 border-dashed rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) return null;

  const filteredDivisions = divisions.filter(d => d.subject_id === activeSubjectId);

  return (
    <div className="max-w-4xl mx-auto p-4 pb-20">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">カリキュラム進捗</h1>

      {/* Subject Progress Bar */}
      {activeSubjectId && (
        <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-end mb-2">
            <div>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">科目全体の進捗</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                ({subjectProgress.completed} / {subjectProgress.total} タスク完了)
              </span>
            </div>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {subjectProgress.percentage}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${subjectProgress.percentage}%` }} />
          </div>
        </div>
      )}

      {/* Subject Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 mb-6">
        {subjects.map(subject => (
          <button
            key={subject.id}
            onClick={() => setActiveSubjectId(subject.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeSubjectId === subject.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {subject.name}
          </button>
        ))}
      </div>

      {filteredDivisions.length === 0 ? (
        <div className="text-center text-gray-500 py-8">この科目のカリキュラムはありません</div>
      ) : (
        filteredDivisions.map(division => {
          const divisionBooks = processedData.booksByDivision.get(division.id) || [];

          return (
            <div key={division.id} className="mb-8">
              <div className="flex justify-between items-center mb-4 border-b pb-2 border-gray-300 dark:border-gray-600">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">{division.name}</h2>
                {isAdmin && (
                  <button
                    onClick={() => { setTargetDivisionId(division.id); setIsAddCustomBookModalOpen(true); }}
                    className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded shadow-sm transition-colors"
                  >
                    + カスタム参考書を追加
                  </button>
                )}
              </div>

              {divisionBooks.length === 0 ? (
                <div className="text-gray-500 text-sm mb-4">参考書がありません</div>
              ) : (
                <div className="space-y-4">
                  {divisionBooks.map(book => {
                    const isExpanded = expandedBookIds.has(book.id);
                    const progress = calculateBookProgress(book);
                    const averageScore = calculateBookAverageScore(book);
                    const bookTasks = processedData.tasksByBook.get(book.id) || [];
                    const maxLaps = book.max_laps || 1;

                    return (
                      <div key={book.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
                        {/* Accordion Header */}
                        <div className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors" onClick={() => toggleBookExpansion(book.id)}>
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-3">
                              {book.image_url ? (
                                <img src={book.image_url} alt={book.name} className="w-12 h-16 object-cover rounded shadow-sm bg-gray-100" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">No Img</div>
                              )}
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  {book.is_custom && (
                                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full font-bold">カスタム</span>
                                  )}
                                  {book.drive_url ? (
                                    <a href={book.drive_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="font-bold text-lg text-blue-600 dark:text-blue-400 hover:underline">
                                      {book.name}
                                    </a>
                                  ) : (
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">{book.name}</h3>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {isAdmin && book.is_custom && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleDeleteCustomBook(book.id); }}
                                  className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                  title="削除"
                                >
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                              <svg className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-10 text-right">{progress}%</span>
                          </div>
                          {averageScore !== null && (
                            <div className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">
                              平均点: <span className="font-bold text-gray-800 dark:text-gray-200">{averageScore}点</span>
                            </div>
                          )}
                        </div>

                        {/* Accordion Content */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                            {book.remarks && (
                              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-b border-gray-200 dark:border-gray-700">
                                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">備考・指示</h4>
                                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{book.remarks}</p>
                              </div>
                            )}
                            {bookTasks.length === 0 ? (
                              <div className="p-4 text-center text-gray-500 text-sm">タスクが登録されていません</div>
                            ) : (
                              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {/* Header Row */}
                                <div className="flex items-center p-3 bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                  <div className="flex-1">タスク名</div>
                                  <div className="flex gap-2 mr-2">
                                    {Array.from({ length: maxLaps }).map((_, i) => (
                                      <div key={i} className="w-8 text-center">{i + 1}周</div>
                                    ))}
                                  </div>
                                </div>

                                {/* Task Rows */}
                                {bookTasks.map(task => (
                                  <div key={task.id} className="flex items-center p-3 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                    <div className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 pr-4">{task.name}</div>
                                    <div className="flex gap-2 mr-2">
                                      {Array.from({ length: maxLaps }).map((_, i) => {
                                        const lap = i + 1;
                                        const key = `${task.id}_${lap}`;
                                        const progressData = userProgress.get(key);
                                        const isChecked = !!progressData && progressData.status === 'completed';
                                        const score = progressData?.score;
                                        const isLocked = lap > 1 && !isLapCompleted(book.id, lap - 1);

                                        return (
                                          <div key={lap} className="flex flex-col items-center gap-1">
                                            <button
                                              onClick={e => { e.stopPropagation(); if (!isLocked) handleCheckboxClick(task, book, lap, isChecked); }}
                                              disabled={isLocked}
                                              className={`w-8 h-8 rounded-md flex items-center justify-center border transition-all ${
                                                isChecked
                                                  ? 'bg-green-500 border-green-500 text-white shadow-sm'
                                                  : isLocked
                                                    ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-50'
                                                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                                              }`}
                                            >
                                              {isChecked && (
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                              )}
                                            </button>
                                            {isChecked && score !== undefined && score !== null && (
                                              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">{score}点</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      <TestScoreModal
        isOpen={isTestModalOpen}
        onClose={() => { setIsTestModalOpen(false); setPendingCompletion(null); }}
        onSubmit={handleModalSubmit}
        isSubmitting={isSubmitting}
      />

      {userId && targetDivisionId && activeSubjectId && (
        <AddCustomBookModal
          isOpen={isAddCustomBookModalOpen}
          onClose={() => setIsAddCustomBookModalOpen(false)}
          userId={userId}
          divisionId={targetDivisionId}
          subjectId={activeSubjectId}
          onAdded={fetchData}
        />
      )}
    </div>
  );
}
