import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { PaymentMethod } from '@aulinha/contracts';
import { Charge } from './charge.entity';

@Entity('payments')
@Index(['teacherId', 'paidAt'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ name: 'charge_id', type: 'uuid' })
  chargeId: string;

  @ManyToOne(() => Charge, (c) => c.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'charge_id' })
  charge: Charge;

  @Column({ name: 'amount_cents', type: 'int' })
  amountCents: number;

  @Column({ name: 'paid_at', type: 'date' })
  paidAt: string;

  @Column({ type: 'varchar', length: 16 })
  method: PaymentMethod;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @Column({ name: 'receipt_number', type: 'varchar', length: 20 })
  receiptNumber: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
