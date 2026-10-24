import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StudentStatus, type StudentColor } from '@turmei/contracts';
import { BillingPlan } from './billing-plan.entity';

@Entity('students')
@Index(['teacherId', 'status'])
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  nickname: string | null;

  @Column({ type: 'varchar', length: 11, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  email: string | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ name: 'guardian_name', type: 'varchar', length: 120, nullable: true })
  guardianName: string | null;

  @Column({ name: 'guardian_phone', type: 'varchar', length: 11, nullable: true })
  guardianPhone: string | null;

  @Column({ name: 'payer_is_guardian', default: false })
  payerIsGuardian: boolean;

  @Column({ type: 'varchar', length: 16, default: 'lavanda' })
  color: StudentColor;

  @Column({ type: 'varchar', length: 16, nullable: true })
  emoji: string | null;

  @Column({ type: 'varchar', length: 16, default: StudentStatus.ATIVO })
  status: StudentStatus;

  @Column({ name: 'paused_until', type: 'date', nullable: true })
  pausedUntil: string | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  tags: string[];

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Nome, apelido, telefone e tags sem acento/caixa — usado na busca. */
  @Column({ name: 'search_text', type: 'text', default: '' })
  searchText: string;

  @OneToMany(() => BillingPlan, (p) => p.student)
  plans: BillingPlan[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
