import { MigrationInterface, QueryRunner } from 'typeorm';

export class EntitlementVersion1793000000001 implements MigrationInterface {
  name = 'EntitlementVersion1793000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "turmei_teachers" ADD COLUMN IF NOT EXISTS "backoffice_entitlement_version" integer NOT NULL DEFAULT 0',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "turmei_teachers" DROP COLUMN IF EXISTS "backoffice_entitlement_version"',
    );
  }
}
