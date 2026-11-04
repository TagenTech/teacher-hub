import { MigrationInterface, QueryRunner } from 'typeorm';
import { lockdownSupabaseTables } from '../database/supabase-lockdown';

export class BackofficeEntitlements1793000000000 implements MigrationInterface {
  name = 'BackofficeEntitlements1793000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "suspended_at" timestamptz',
    );
    await queryRunner.query(
      'ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "backoffice_entitlement_id" uuid',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "teachers_backoffice_entitlement_idx" ON "teachers" ("backoffice_entitlement_id")',
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "webhook_events" (
        "dedupe_key" varchar(64) PRIMARY KEY,
        "event" varchar(64) NOT NULL,
        "processed_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await lockdownSupabaseTables(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "webhook_events"');
    await queryRunner.query('DROP INDEX IF EXISTS "teachers_backoffice_entitlement_idx"');
    await queryRunner.query('ALTER TABLE "teachers" DROP COLUMN IF EXISTS "backoffice_entitlement_id"');
    await queryRunner.query('ALTER TABLE "teachers" DROP COLUMN IF EXISTS "suspended_at"');
  }
}
