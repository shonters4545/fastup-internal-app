/**
 * 教材のプレースホルダー表紙コンポーネント
 * レベル別配色で科目タグ・タイトル・レベルラベルを表示
 */

type BookLevel = 'core' | 'advance' | 'top' | 'all';

const LEVEL_STYLES: Record<BookLevel, { bg: string; text: string; badge: string; border?: string }> = {
  core:    { bg: 'bg-white', text: 'text-gray-800', badge: 'bg-blue-500', border: 'border border-gray-200' },
  advance: { bg: 'bg-[#827E64]', text: 'text-white', badge: 'bg-[#6B6850]' },
  top:     { bg: 'bg-[#333333]', text: 'text-white', badge: 'bg-[#1A1A1A]' },
  all:     { bg: 'bg-[#B8860B]', text: 'text-white', badge: 'bg-[#8B6508]' },
};

interface BookCoverProps {
  name: string;
  subjectName: string;
  level: BookLevel | null;
  className?: string;
}

export default function BookCover({ name, subjectName, level, className = '' }: BookCoverProps) {
  const style = LEVEL_STYLES[level || 'all'];
  const displayLevel = level ? level.toUpperCase() : '';

  // タイトルが長い場合、フォントサイズを調整
  const titleSize = name.length > 16 ? 'text-[9px]' : name.length > 10 ? 'text-[10px]' : 'text-xs';

  return (
    <div
      className={`relative w-12 h-16 rounded-sm overflow-hidden flex flex-col items-center justify-center shadow-sm flex-shrink-0 ${style.bg} ${style.border || ''} ${className}`}
    >
      {/* 科目バッジ（左上） */}
      <span className={`absolute top-0.5 left-0.5 px-1 py-px rounded-sm text-[6px] text-white leading-tight ${style.badge}`}>
        {subjectName.length > 3 ? subjectName.substring(0, 3) : subjectName}
      </span>

      {/* タイトル（中央） */}
      <span className={`${titleSize} ${style.text} font-bold leading-tight text-center px-0.5 mt-1`}>
        {name.length > 24 ? name.substring(0, 24) + '…' : name}
      </span>

      {/* レベルラベル（下部） */}
      {displayLevel && (
        <span className={`absolute bottom-0.5 text-[5px] ${style.text} opacity-50 tracking-wider`}>
          {displayLevel}
        </span>
      )}
    </div>
  );
}
