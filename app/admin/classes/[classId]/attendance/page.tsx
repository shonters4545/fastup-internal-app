'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type ClassInfo = {
  title: string;
  instructor_name: string | null;
  start_time: string;
  end_time: string;
};

type Room = {
  id: string;
  label: string;
  room_type: string;
  instructor_id: string | null;
  instructor_name: string | null;
  capacity: number;
};

type Attendee = {
  id: string;
  student_name: string | null;
  attended_at: string | null;
  instructor_name: string | null;
  study_material: string | null;
  user_id: string;
  subject_id: string | null;
  book_id: string | null;
  room_id: string | null;
  is_trial: boolean;
  round_checks: boolean[];
};

type Instructor = {
  id: string;
  display_name: string;
};

type UserMeta = {
  id: string;
  display_name: string;
  created_at: string;
};

type SatisfactionData = {
  userId: string;
  score: number | null;
};

export default function AdminClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const { currentUser, loading: authLoading } = useAuth();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [userMeta, setUserMeta] = useState<Map<string, UserMeta>>(new Map());
  const [satisfactionData, setSatisfactionData] = useState<Map<string, number | null>>(new Map());
  const [attendanceCounts, setAttendanceCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addMemberRoomId, setAddMemberRoomId] = useState<string | null>(null);
  const [selectedMoveUserId, setSelectedMoveUserId] = useState('');

  const fetchData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const [classRes, roomsRes, attendeesRes, instructorsRes] = await Promise.all([
        (supabase.from('classes') as any).select('title, instructor_name, start_time, end_time').eq('id', classId).single(),
        (supabase.from('class_rooms') as any).select('*').eq('class_id', classId).order('label'),
        (supabase.from('attendance_records') as any).select('id, user_id, instructor_name, student_name, study_material, attended_at, subject_id, book_id, room_id, is_trial, round_checks').eq('class_id', classId).order('attended_at', { ascending: true }),
        (supabase.from('users') as any).select('id, display_name').in('role', ['admin', 'super']),
      ]);

      if (classRes.error) throw new Error('特訓情報が見つかりません。');
      setClassInfo(classRes.data);
      setRooms(roomsRes.data || []);
      setAttendees((attendeesRes.data || []).map((a: any) => ({
        ...a,
        round_checks: Array.isArray(a.round_checks) ? a.round_checks : [false, false, false],
      })));
      setInstructors((instructorsRes.data || []).sort((a: any, b: any) => a.display_name.localeCompare(b.display_name)));

      // ユーザーメタ情報（初回/1か月判定用）
      const userIds = (attendeesRes.data || []).map((a: any) => a.user_id);
      if (userIds.length > 0) {
        const { data: usersData } = await (supabase.from('users') as any)
          .select('id, display_name, created_at')
          .in('id', userIds);
        const meta = new Map<string, UserMeta>();
        (usersData || []).forEach((u: any) => meta.set(u.id, u));
        setUserMeta(meta);

        // 各ユーザーの出席回数（体験除く）を取得して初回判定に使う
        const { data: allAttendance } = await (supabase.from('attendance_records') as any)
          .select('user_id, is_trial')
          .in('user_id', userIds);
        const counts = new Map<string, number>();
        (allAttendance || []).forEach((a: any) => {
          if (!a.is_trial) {
            counts.set(a.user_id, (counts.get(a.user_id) || 0) + 1);
          }
        });
        setAttendanceCounts(counts);

        // 前回満足度データ取得
        const { data: surveyModel } = await (supabase.from('survey_models') as any)
          .select('id, form_fields')
          .eq('type', 'class_feedback')
          .limit(1)
          .single();

        if (surveyModel) {
          // master_score フィールドのインデックスを探す
          const fields = surveyModel.form_fields || [];
          let masterScoreIndex = -1;
          let scoreMap: Record<string, number> = {};
          fields.forEach((f: any, idx: number) => {
            if (f.analysisKey === 'master_score') {
              masterScoreIndex = idx;
              scoreMap = f.scoreMap || {};
            }
          });

          if (masterScoreIndex >= 0) {
            // 各ユーザーの最新の回答を取得（現在の特訓ではなく直前の特訓）
            const { data: prevResponses } = await (supabase.from('survey_responses') as any)
              .select('user_id, responses, submitted_at, class_id')
              .eq('type', 'class_feedback')
              .in('user_id', userIds)
              .neq('class_id', classId)
              .order('submitted_at', { ascending: false });

            const satMap = new Map<string, number | null>();
            const seen = new Set<string>();
            (prevResponses || []).forEach((r: any) => {
              if (seen.has(r.user_id)) return;
              seen.add(r.user_id);
              const responses = r.responses;
              if (Array.isArray(responses) && responses[masterScoreIndex] !== undefined) {
                const val = responses[masterScoreIndex];
                const numScore = scoreMap[val] ?? (typeof val === 'number' ? val : parseInt(val));
                satMap.set(r.user_id, isNaN(numScore) ? null : numScore);
              }
            });
            setSatisfactionData(satMap);
          }
        }
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'データ取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  // ルーム別の参加者を整理
  const roomAttendees = useMemo(() => {
    const map = new Map<string, Attendee[]>();
    // 各ルームの初期化
    rooms.forEach(r => map.set(r.id, []));
    map.set('unassigned', []); // ルーム未割当

    attendees.forEach(a => {
      if (a.room_id && map.has(a.room_id)) {
        map.get(a.room_id)!.push(a);
      } else {
        map.get('unassigned')!.push(a);
      }
    });
    return map;
  }, [rooms, attendees]);

  // 担当講師の変更
  const handleInstructorChange = async (roomId: string, instructorId: string) => {
    try {
      const supabase = createClient();
      const instructor = instructors.find(i => i.id === instructorId);
      await (supabase.from('class_rooms') as any)
        .update({
          instructor_id: instructorId || null,
          instructor_name: instructor?.display_name || null,
        })
        .eq('id', roomId);

      // ルーム内の全出席レコードのinstructor_nameも更新
      if (instructor) {
        const roomMembers = roomAttendees.get(roomId) || [];
        const memberIds = roomMembers.map(m => m.id);
        if (memberIds.length > 0) {
          await (supabase.from('attendance_records') as any)
            .update({ instructor_name: instructor.display_name })
            .in('id', memberIds);
        }
      }

      fetchData();
    } catch (err) {
      console.error('Error updating instructor:', err);
      alert('講師の更新に失敗しました。');
    }
  };

  // 周回チェックの更新
  const handleRoundCheck = async (attendeeId: string, checkIndex: number) => {
    try {
      const attendee = attendees.find(a => a.id === attendeeId);
      if (!attendee) return;
      const newChecks = [...attendee.round_checks];
      newChecks[checkIndex] = !newChecks[checkIndex];

      const supabase = createClient();
      await (supabase.from('attendance_records') as any)
        .update({ round_checks: newChecks })
        .eq('id', attendeeId);

      setAttendees(prev => prev.map(a =>
        a.id === attendeeId ? { ...a, round_checks: newChecks } : a
      ));
    } catch (err) {
      console.error('Error updating round check:', err);
    }
  };

  // メンバーのルーム移動
  const handleMoveMember = async (attendeeId: string, targetRoomId: string | null) => {
    try {
      const supabase = createClient();
      const targetRoom = rooms.find(r => r.id === targetRoomId);
      await (supabase.from('attendance_records') as any)
        .update({
          room_id: targetRoomId,
          instructor_name: targetRoom?.instructor_name || null,
        })
        .eq('id', attendeeId);
      fetchData();
    } catch (err) {
      console.error('Error moving member:', err);
      alert('メンバーの移動に失敗しました。');
    }
  };

  // メンバーの削除（ルームから外す）
  const handleRemoveFromRoom = async (attendeeId: string) => {
    if (!window.confirm('このメンバーをルームから外しますか？')) return;
    await handleMoveMember(attendeeId, null);
  };

  // Zルームからメンバーを別ルームに追加
  const handleAddFromZ = async (targetRoomId: string) => {
    if (!selectedMoveUserId) return;
    const attendee = attendees.find(a => a.id === selectedMoveUserId);
    if (!attendee) return;
    await handleMoveMember(attendee.id, targetRoomId);
    setAddMemberRoomId(null);
    setSelectedMoveUserId('');
  };

  // バッジ判定
  const getBadges = (attendee: Attendee) => {
    const badges: { text: string; color: string }[] = [];

    // 体験
    if (attendee.is_trial) {
      badges.push({ text: '体験', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200' });
    }

    // 初回（体験除く出席が1回 = 今回が初）
    const nonTrialCount = attendanceCounts.get(attendee.user_id) || 0;
    if (!attendee.is_trial && nonTrialCount <= 1) {
      badges.push({ text: '初回', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200' });
    }

    // 1か月以内
    const meta = userMeta.get(attendee.user_id);
    if (meta) {
      const createdAt = new Date(meta.created_at);
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      if (createdAt > oneMonthAgo) {
        badges.push({ text: '1か月以内', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' });
      }
    }

    // 満足度
    const score = satisfactionData.get(attendee.user_id);
    if (score !== undefined && score !== null) {
      if (score <= 7) {
        badges.push({ text: `前回満足度: ${score} 要対応`, color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 font-bold' });
      } else {
        badges.push({ text: `前回満足度: ${score}`, color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' });
      }
    }

    return badges;
  };

  // Zルームの参加者（出席予定未提出）
  const zRoom = rooms.find(r => r.label === 'Z');
  const zAttendees = zRoom ? (roomAttendees.get(zRoom.id) || []) : [];
  const unassignedAttendees = roomAttendees.get('unassigned') || [];

  if (authLoading || loading) {
    return (
      <div className="w-full max-w-4xl text-center p-8 animate-fade-in mt-8 mx-auto">
        <div className="w-12 h-12 border-4 border-teal-500 border-dashed rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-500 mt-4">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-lg text-center p-8 bg-red-100 dark:bg-red-900/50 rounded-lg animate-fade-in mt-8 mx-auto">
        <h2 className="text-2xl font-bold text-red-800 dark:text-red-200">エラー</h2>
        <p className="mt-2 text-red-600 dark:text-red-300">{error}</p>
        <Link href="/admin/classes" className="mt-6 inline-block bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg">特訓管理に戻る</Link>
      </div>
    );
  }

  const regularRooms = rooms.filter(r => r.label !== 'Z');

  return (
    <div className="w-full max-w-6xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 animate-fade-in mt-8 mx-auto">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row justify-between items-start mb-8 border-b dark:border-gray-700 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">特訓詳細</h1>
          {classInfo && (
            <div className="mt-2 space-y-1">
              <p className="text-xl font-semibold text-teal-600 dark:text-teal-400">{classInfo.title}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(classInfo.start_time).toLocaleString('ja-JP')} 〜 {new Date(classInfo.end_time).toLocaleTimeString('ja-JP')}
              </p>
            </div>
          )}
        </div>
        <Link href="/admin/classes" className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0">&larr; 特訓管理に戻る</Link>
      </div>

      {/* サマリー */}
      <div className="mb-6 flex flex-wrap gap-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
        <div className="text-lg font-bold text-gray-700 dark:text-gray-200">
          総出席者: <span className="text-2xl text-teal-600 dark:text-teal-400">{attendees.length}</span> 名
        </div>
        <div className="text-lg font-bold text-gray-700 dark:text-gray-200">
          ルーム数: <span className="text-2xl text-blue-600 dark:text-blue-400">{regularRooms.length}</span>
        </div>
      </div>

      {/* ルームが未作成の場合 */}
      {rooms.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 mb-8">
          <p className="text-gray-500 dark:text-gray-400 mb-2">ルームが作成されていません。</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">出席管理カレンダーから出席予定確定時にルームが自動生成されます。</p>
        </div>
      )}

      {/* ルーム別表示 */}
      <div className="space-y-6">
        {regularRooms.map(room => {
          const members = roomAttendees.get(room.id) || [];
          const isOverCapacity = members.length > 10;
          const roomTypeLabel = room.room_type === 'science' ? '理系' : '文系';
          const roomTypeColor = room.room_type === 'science' ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400';

          return (
            <div key={room.id} className={`bg-white dark:bg-gray-700 rounded-2xl shadow-md border overflow-hidden ${isOverCapacity ? 'border-red-400 dark:border-red-500' : 'border-gray-100 dark:border-gray-600'}`}>
              {/* ルームヘッダー */}
              <div className={`px-6 py-4 border-b flex flex-wrap justify-between items-center gap-3 ${isOverCapacity ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800' : 'bg-teal-50 dark:bg-teal-900/30 border-teal-100 dark:border-teal-800'}`}>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">教室{room.label}</h3>
                  <span className={`text-sm font-bold ${roomTypeColor}`}>[{roomTypeLabel}]</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${isOverCapacity ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200' : 'bg-white dark:bg-teal-800 text-teal-600 dark:text-teal-300'}`}>
                    {members.length}名{isOverCapacity && ' (定員超過!)'}
                  </span>
                </div>
                {/* 担当講師プルダウン */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400">担当講師:</label>
                  <select
                    value={room.instructor_id || ''}
                    onChange={(e) => handleInstructorChange(room.id, e.target.value)}
                    className="p-1.5 text-sm border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600 rounded-md dark:text-white"
                  >
                    <option value="">-- 未選択 --</option>
                    {instructors.map(inst => (
                      <option key={inst.id} value={inst.id}>{inst.display_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* メンバーリスト */}
              {members.length === 0 ? (
                <div className="p-6 text-center text-gray-400">メンバーがいません</div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-600">
                  {members.map(attendee => {
                    const badges = getBadges(attendee);
                    return (
                      <li key={attendee.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-600/50 transition-colors">
                        <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/admin/student/${attendee.user_id}`} className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
                              {attendee.student_name || '（名前未設定）'}
                            </Link>
                            {badges.map((badge, i) => (
                              <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${badge.color}`}>{badge.text}</span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* 周回チェック */}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-400 mr-1">巡回:</span>
                              {[0, 1, 2].map(i => (
                                <button
                                  key={i}
                                  onClick={() => handleRoundCheck(attendee.id, i)}
                                  className={`w-5 h-5 rounded border-2 transition-colors ${
                                    attendee.round_checks[i]
                                      ? 'bg-green-500 border-green-600 text-white'
                                      : 'bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500'
                                  }`}
                                  title={`巡回${i + 1}回目`}
                                >
                                  {attendee.round_checks[i] && (
                                    <svg className="w-3 h-3 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              ))}
                            </div>
                            {attendee.attended_at && (
                              <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                {new Date(attendee.attended_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {/* ルームから外す */}
                            <button
                              onClick={() => handleRemoveFromRoom(attendee.id)}
                              className="text-red-400 hover:text-red-600 p-0.5"
                              title="ルームから外す"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded text-sm text-gray-600 dark:text-gray-300">
                          <span className="text-xs font-bold text-gray-400 dark:text-gray-500">教材: </span>
                          {attendee.study_material || '（未入力）'}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* メンバー追加ボタン（Zルーム or 未割当から） */}
              {(zAttendees.length > 0 || unassignedAttendees.length > 0) && (
                <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-600">
                  {addMemberRoomId === room.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedMoveUserId}
                        onChange={(e) => setSelectedMoveUserId(e.target.value)}
                        className="flex-grow p-1.5 text-sm border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600 rounded-md dark:text-white"
                      >
                        <option value="">-- 追加するメンバー --</option>
                        {[...zAttendees, ...unassignedAttendees].map(a => (
                          <option key={a.id} value={a.id}>{a.student_name || '不明'}{a.room_id ? ' (Z)' : ' (未割当)'}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAddFromZ(room.id)}
                        disabled={!selectedMoveUserId}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md disabled:bg-gray-400"
                      >
                        追加
                      </button>
                      <button
                        onClick={() => { setAddMemberRoomId(null); setSelectedMoveUserId(''); }}
                        className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-500 rounded-md"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddMemberRoomId(room.id)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      + メンバーを追加
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Zルーム（未提出者） */}
        {zRoom && zAttendees.length > 0 && (
          <div className="bg-white dark:bg-gray-700 rounded-2xl shadow-md border border-yellow-300 dark:border-yellow-700 overflow-hidden">
            <div className="px-6 py-4 border-b bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-200">教室Z (出席予定未提出)</h3>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200">{zAttendees.length}名</span>
              </div>
              <span className="text-xs text-yellow-600 dark:text-yellow-400">担当講師なし</span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-600">
              {zAttendees.map(attendee => {
                const badges = getBadges(attendee);
                return (
                  <li key={attendee.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-600/50 transition-colors">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/student/${attendee.user_id}`} className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
                          {attendee.student_name || '（名前未設定）'}
                        </Link>
                        {badges.map((badge, i) => (
                          <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${badge.color}`}>{badge.text}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          onChange={(e) => {
                            if (e.target.value) handleMoveMember(attendee.id, e.target.value);
                            e.target.value = '';
                          }}
                          className="p-1 text-xs border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600 rounded-md dark:text-white"
                          defaultValue=""
                        >
                          <option value="">ルームに移動...</option>
                          {regularRooms.map(r => (
                            <option key={r.id} value={r.id}>教室{r.label} ({r.room_type === 'science' ? '理' : '文'})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-2 bg-gray-50 dark:bg-gray-800/50 p-2 rounded text-sm text-gray-600 dark:text-gray-300">
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-500">教材: </span>
                      {attendee.study_material || '（未入力）'}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 未割当（ルームなし） */}
        {unassignedAttendees.length > 0 && (
          <div className="bg-white dark:bg-gray-700 rounded-2xl shadow-md border border-gray-300 dark:border-gray-600 overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-600 dark:text-gray-300">未割当</h3>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-200 text-gray-600">{unassignedAttendees.length}名</span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-600">
              {unassignedAttendees.map(attendee => {
                const badges = getBadges(attendee);
                return (
                  <li key={attendee.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-600/50 transition-colors">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/student/${attendee.user_id}`} className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
                          {attendee.student_name || '（名前未設定）'}
                        </Link>
                        {badges.map((badge, i) => (
                          <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${badge.color}`}>{badge.text}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        {rooms.length > 0 && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) handleMoveMember(attendee.id, e.target.value);
                              e.target.value = '';
                            }}
                            className="p-1 text-xs border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600 rounded-md dark:text-white"
                            defaultValue=""
                          >
                            <option value="">ルームに移動...</option>
                            {rooms.map(r => (
                              <option key={r.id} value={r.id}>{r.label === 'Z' ? '教室Z' : `教室${r.label}`}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 bg-gray-50 dark:bg-gray-800/50 p-2 rounded text-sm text-gray-600 dark:text-gray-300">
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-500">教材: </span>
                      {attendee.study_material || '（未入力）'}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
