import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ChargeKind } from '@turmei/contracts';
import { Student } from '../../alunos/entities/student.entity';
import { Payment } from './payment.entity';

@Entity('charges')
@Index(['teacherId', 'dueDate'])
// Uma mensalidade / fechamento por aluno e mês: a geração pode rodar várias vezes.
@Index(['studentId', 'kind', 'referenceMonth'], {
  unique: true,
  where: `"reference_month" IS NOT NULL AND "kind" IN ('MENSALIDADE', 'AULAS_DO_MES')`,
})
export class Charge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'varchar', length: 16 })
  kind: ChargeKind;

  @Column({ name: 'reference_month', type: 'varchar', length: 7, nullable: true })
  referenceMonth: string | null;

  @Column({ type: 'varchar', length: 160 })
  description: string;

  @Column({ name: 'amount_cents', type: 'int' })
  amountCents: number;

  @Column({ name: 'discount_cents', type: 'int', default: 0 })
  discountCents: number;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt: Date | null;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string | null;

  /** Pacotes: quantas aulas o pacote cobre. */
  @Column({ name: 'package_lessons', type: 'int', nullable: true })
  packageLessons: number | null;

  @OneToMany(() => Payment, (p) => p.charge)
  payments: Payment[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
