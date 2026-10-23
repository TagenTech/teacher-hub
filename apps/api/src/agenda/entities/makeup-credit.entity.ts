import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { MakeupCreditStatus } from '@aulinha/contracts';
import { Student } from '../../alunos/entities/student.entity';

/** Aula devida ao aluno (falta do professor, falta justificada, feriado…). */
@Entity('makeup_credits')
@Index(['teacherId', 'status'])
export class MakeupCredit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'origin_lesson_id', type: 'uuid', nullable: true })
  originLessonId: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', length: 16, default: MakeupCreditStatus.ABERTO })
  status: MakeupCreditStatus;

  @Column({ name: 'used_lesson_id', type: 'uuid', nullable: true })
  usedLessonId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
