import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import {
  DEFAULT_LESSON_REMINDER_MINUTES,
  DEFAULT_PAYMENT_REMINDER_HOUR,
  DEFAULT_TIMEZONE,
  PixKeyType,
} from '@aulinha/contracts';

@Entity('teachers')
export class Teacher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ unique: true, length: 180 })
  email: string;

  /** Nulo para quem entra só com Google/Microsoft/Meta. */
  @Column({ name: 'password_hash', type: 'varchar', nullable: true, select: false })
  passwordHash: string | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  /** CPF cifrado (AES-256-GCM, chave fora do banco). Nunca volta inteiro para o navegador. */
  @Column({ name: 'cpf_encrypted', type: 'text', nullable: true, select: false })
  cpfEncrypted: string | null;

  /** Índice cego (HMAC) do CPF: garante unicidade sem guardar o número. */
  @Column({ name: 'cpf_hash', type: 'varchar', length: 64, nullable: true, unique: true })
  cpfHash: string | null;

  /** Só para exibir mascarado (***.456.789-**): dígitos 4 a 9. */
  @Column({ name: 'cpf_masked', type: 'varchar', length: 14, nullable: true })
  cpfMasked: string | null;

  @Column({ type: 'varchar', length: 11, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  state: string | null;

  @Column({ name: 'terms_accepted_at', type: 'timestamptz', nullable: true })
  termsAcceptedAt: Date | null;

  @Column({ name: 'profile_completed_at', type: 'timestamptz', nullable: true })
  profileCompletedAt: Date | null;

  /** Tokens emitidos antes disto são recusados (troca de senha, "sair de todos os aparelhos"). */
  @Column({ name: 'tokens_valid_after', type: 'timestamptz', nullable: true })
  tokensValidAfter: Date | null;

  /** Segredo TOTP cifrado (2FA). */
  @Column({ name: 'mfa_secret_encrypted', type: 'text', nullable: true, select: false })
  mfaSecretEncrypted: string | null;

  /** Segredo em configuração (antes de confirmar o primeiro código). */
  @Column({ name: 'mfa_pending_secret_encrypted', type: 'text', nullable: true, select: false })
  mfaPendingSecretEncrypted: string | null;

  @Column({ name: 'mfa_enabled_at', type: 'timestamptz', nullable: true })
  mfaEnabledAt: Date | null;

  /** Último passo TOTP aceito (impede reusar o mesmo código). */
  @Column({ name: 'mfa_last_step', type: 'bigint', nullable: true, select: false })
  mfaLastStep: string | null;

  @Column({ default: DEFAULT_TIMEZONE, length: 64 })
  timezone: string;

  @Column({ name: 'pix_key', type: 'varchar', length: 140, nullable: true })
  pixKey: string | null;

  @Column({ name: 'pix_key_type', type: 'varchar', length: 16, nullable: true })
  pixKeyType: PixKeyType | null;

  @Column({ name: 'lesson_reminder_minutes', default: DEFAULT_LESSON_REMINDER_MINUTES })
  lessonReminderMinutes: number;

  @Column({ name: 'payment_reminder_hour', default: DEFAULT_PAYMENT_REMINDER_HOUR })
  paymentReminderHour: number;

  @Column({ name: 'default_lesson_minutes', default: 60 })
  defaultLessonMinutes: number;

  @Column({ name: 'whatsapp_template', type: 'text', nullable: true })
  whatsappTemplate: string | null;

  /** Token secreto da URL do feed .ics (trocável). */
  @Column({ name: 'ics_token', type: 'varchar', length: 64, nullable: true, unique: true })
  icsToken: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
