import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { AuthProvider } from '@aulinha/contracts';
import { Teacher } from '../../professor/entities/teacher.entity';

/** Conta social ligada ao professor (um professor pode ter Google + Microsoft + senha). */
@Entity('auth_identities')
@Index(['provider', 'providerUserId'], { unique: true })
export class AuthIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => Teacher, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: Teacher;

  @Column({ type: 'varchar', length: 16 })
  provider: AuthProvider;

  @Column({ name: 'provider_user_id', type: 'varchar', length: 255 })
  providerUserId: string;

  @Column({ type: 'varchar', length: 180, nullable: true })
  email: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
