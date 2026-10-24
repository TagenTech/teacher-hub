import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LessonStatus, type LessonMode } from '@turmei/contracts';
import { Student } from '../../alunos/entities/student.entity';

/** Uma aula de fato (gerada de um horário fixo ou avulsa). */
@Entity('lessons')
@Index(['teacherId', 'startsAt'])
@Index(['studentId', 'startsAt'])
// Uma ocorrência por horário fixo e dia: a geração pode rodar várias vezes sem duplicar.
@Index(['slotId', 'occurrenceDate'], { unique: true, where: '"slot_id" IS NOT NULL' })
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'slot_id', type: 'uuid', nullable: true })
  slotId: string | null;

  /** Dia (fuso do professor) da ocorrência do horário fixo. */
  @Column({ name: 'occurrence_date', type: 'date', nullable: true })
  occurrenceDate: string | null;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt: Date;

  @Column({ type: 'varchar', length: 20, default: LessonStatus.AGENDADA })
  status: LessonStatus;

  @Column({ type: 'varchar', length: 16 })
  mode: LessonMode;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  @Column({ name: 'meeting_url', type: 'varchar', length: 500, nullable: true })
  meetingUrl: string | null;

  @Column({ default: false })
  justified: boolean;

  @Column({ name: 'absence_reason', type: 'varchar', length: 300, nullable: true })
  absenceReason: string | null;

  @Column({ default: true })
  chargeable: boolean;

  /** Preço da aula na época (planos por aula/pacote). */
  @Column({ name: 'price_cents', type: 'int', nullable: true })
  priceCents: number | null;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'text', nullable: true })
  homework: string | null;

  @Column({ name: 'makeup_credit_id', type: 'uuid', nullable: true })
  makeupCreditId: string | null;

  @Column({ name: 'rescheduled_from_id', type: 'uuid', nullable: true })
  rescheduledFromId: string | null;

  /** Bloqueio de agenda que cancelou esta aula (para desfazer). */
  @Column({ name: 'block_id', type: 'uuid', nullable: true })
  blockId: string | null;

  @Index()
  @Column({ name: 'charge_id', type: 'uuid', nullable: true })
  chargeId: string | null;

  @Column({ name: 'marked_at', type: 'timestamptz', nullable: true })
  markedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
