import { initials, type StudentColor } from '@turmei/contracts';
import { cn } from '@/lib/utils';

const sizes = {
  sm: 'size-10 rounded-[0.9rem] text-base',
  md: 'size-12 rounded-2xl text-lg',
  lg: 'size-20 rounded-[1.6rem] text-3xl',
  xl: 'size-24 rounded-[2rem] text-4xl',
};

export function studentColorStyle(color: StudentColor) {
  return { background: `var(--stu-${color})`, color: `var(--stu-${color}-fg)` };
}

export function StudentAvatar({
  name,
  color,
  emoji,
  size = 'md',
  className,
}: {
  name: string;
  color: StudentColor;
  emoji?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center font-display font-black', sizes[size], className)}
      style={studentColorStyle(color)}
    >
      {emoji || initials(name) || '?'}
    </span>
  );
}
