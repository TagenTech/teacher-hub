import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { BillingPlanType } from '@aulinha/contracts';
import { Student } from './student.entity';

/**
 * Como o aluno paga, com vigência. Reajuste = encerra o plano atual (validTo) e cria outro,
 * então cobranças antigas continuam apontando para o valor da época.
 */
@Entity('billing_plans')
@Index(['studentId', 'validFrom'])
export class BillingPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, (s) => s.plans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'varchar', length: 16 })
  type: BillingPlanType;

  @Column({ name: 'monthly_fee_cents', type: 'int', nullable: true })
  monthlyFeeCents: number | null;

  @Column({ name: 'lesson_price_cents', type: 'int', nullable: true })
  lessonPriceCents: number | null;

  @Column({ name: 'package_lessons', type: 'int', nullable: true })
  packageLessons: number | null;

  @Column({ name: 'package_price_cents', type: 'int', nullable: true })
  packagePriceCents: number | null;

  @Column({ name: 'due_day', type: 'smallint', nullable: true })
  dueDay: number | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom: string;

  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
