import { MigrationInterface, QueryRunner } from "typeorm";

/** Tabelas com o prefixo turmei_ (entityPrefix). Telefones de outros países (E.164: "+" + até 15 dígitos) não cabiam em varchar(11). */
export class WidenPhoneColumns1793026453179 implements MigrationInterface {
    name = 'WidenPhoneColumns1793026453179'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "turmei_students" ALTER COLUMN "phone" TYPE character varying(16)`);
        await queryRunner.query(`ALTER TABLE "turmei_students" ALTER COLUMN "guardian_phone" TYPE character varying(16)`);
        await queryRunner.query(`ALTER TABLE "turmei_teachers" ALTER COLUMN "phone" TYPE character varying(16)`);
    }

    // Falha de propósito se já existir número internacional (não corta dados em silêncio).
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "turmei_teachers" ALTER COLUMN "phone" TYPE character varying(11)`);
        await queryRunner.query(`ALTER TABLE "turmei_students" ALTER COLUMN "guardian_phone" TYPE character varying(11)`);
        await queryRunner.query(`ALTER TABLE "turmei_students" ALTER COLUMN "phone" TYPE character varying(11)`);
    }
}
