import type { StudentRefDto } from '@aulinha/contracts';
import type { Student } from '../../alunos/entities/student.entity';

export function toStudentRef(s: Student): StudentRefDto {
  return { id: s.id, name: s.name, nickname: s.nickname, color: s.color, emoji: s.emoji, status: s.status };
}
