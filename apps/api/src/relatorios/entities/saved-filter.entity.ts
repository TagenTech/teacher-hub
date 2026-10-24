import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { SavedFilterDto, SavedFilterScope } from '@turmei/contracts';

@Entity('saved_filters')
@Index(['teacherId', 'scope'])
export class SavedFilter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  scope: SavedFilterScope;

  @Column({ type: 'varchar', length: 20 })
  period: string;

  @Column({ type: 'jsonb' })
  criteria: SavedFilterDto['criteria'];

  @Column({ default: false })
  pinned: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
