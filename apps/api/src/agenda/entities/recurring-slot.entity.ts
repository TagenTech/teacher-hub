import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { LessonMode } from '@turmei/contracts';
import { Student } from '../../alunos/entities/student.entity';

/** Horário fixo semanal (ex.: toda terça 19:00, 60 min). Gera as aulas automaticamente. */
@Entity('recurring_slots')
@Index(['teacherId', 'studentId'])
export class RecurringSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  /** 0 = domingo … 6 = sábado */
  @Column({ type: 'smallint' })
  weekday: number;

  @Column({ name: 'start_time', type: 'varchar', length: 5 })
  startTime: string;

  @Column({ name: 'duration_min', type: 'smallint' })
  durationMin: number;

  @Column({ type: 'varchar', length: 16 })
  mode: LessonMode;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  @Column({ name: 'meeting_url', type: 'varchar', length: 500, nullable: true })
  meetingUrl: string | null;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom: string;

  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
