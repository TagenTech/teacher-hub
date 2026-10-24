import { describePlan, displayName, type StudentListItemDto } from '@turmei/contracts';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { StudentStatusBadge } from './status-badge';
import { StudentAvatar } from './student-avatar';

export function StudentRow({ student }: { student: StudentListItemDto }) {
  const nick = displayName(student);
  return (
    <Link
      href={`/alunos/${student.id}`}
      className="flex items-center gap-3.5 rounded-2xl p-3 transition-colors hover:bg-muted active:bg-muted"
    >
      <StudentAvatar name={student.name} color={student.color} emoji={student.emoji} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-display text-[1.05rem] font-extrabold">{nick}</span>
          <StudentStatusBadge status={student.status} compact />
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {student.currentPlan ? describePlan(student.currentPlan) : 'Sem plano em vigor'}
          {nick !== student.name ? ` · ${student.name}` : ''}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" aria-hidden />
    </Link>
  );
}
