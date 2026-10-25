import { MigrationInterface, QueryRunner } from 'typeorm';
import { disableSupabaseRls, lockdownSupabaseTables } from '../database/supabase-lockdown';

export class SupabaseLockdown1792891615921 implements MigrationInterface {
  name = 'SupabaseLockdown1792891615921';

  async up(queryRunner: QueryRunner): Promise<void> {
    await lockdownSupabaseTables(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await disableSupabaseRls(queryRunner);
  }
}
