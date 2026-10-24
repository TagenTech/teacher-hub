import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { NotificationType } from '@turmei/contracts';

/** O que já foi avisado — o índice único impede lembrete duplicado. */
@Entity('notification_logs')
@Index(['type', 'refId', 'key'], { unique: true })
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ type: 'varchar', length: 24 })
  type: NotificationType;

  @Column({ name: 'ref_id', type: 'varchar', length: 64 })
  refId: string;

  /** Ex.: data do dia ou horário da aula. */
  @Column({ type: 'varchar', length: 40 })
  key: string;

  @CreateDateColumn({ name: 'sent_at', type: 'timestamptz' })
  sentAt: Date;
}
