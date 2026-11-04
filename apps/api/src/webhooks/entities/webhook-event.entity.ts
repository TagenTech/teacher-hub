import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** Dedupe de webhooks do backoffice: a mesma entrega nunca processa duas vezes. */
@Entity('webhook_events')
export class WebhookEvent {
  /** sha256(`${timestamp}.${event}.${entitlement.id}.${sent_at}`). */
  @PrimaryColumn({ name: 'dedupe_key', type: 'varchar', length: 64 })
  dedupeKey: string;

  @Column({ length: 64 })
  event: string;

  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt: Date;
}
