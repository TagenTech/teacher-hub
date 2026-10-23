import { MigrationInterface, QueryRunner } from "typeorm";
import { maskCpf } from "@aulinha/contracts";
import { blindIndex, decryptField, encryptField } from "../common/crypto/field-crypto";

export class SecurityHardening1792770540566 implements MigrationInterface {
    name = 'SecurityHardening1792770540566'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "security_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid, "type" character varying(32) NOT NULL, "ip" character varying(64), "user_agent" character varying(255), "meta" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6fc100d6700780737348df0d3ae" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5171b7179792cf95caf988c881" ON "security_events" ("teacher_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "mfa_recovery_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL, "code_hash" character varying(64) NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0076416b1b84361afc3371ba121" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0e6b04118c450eb6ce644a2d6f" ON "mfa_recovery_codes" ("teacher_id") `);
        await queryRunner.query(`ALTER TABLE "teachers" DROP CONSTRAINT "UQ_078d9a8b55bab3710f805cf8fcc"`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "cpf_encrypted" text`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "cpf_hash" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD CONSTRAINT "UQ_edefc8108ed873672be2b67c934" UNIQUE ("cpf_hash")`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "cpf_masked" character varying(14)`);
        // CPF em texto puro → cifrado (AES-256-GCM) + índice cego, antes de apagar a coluna antiga.
        const rows: { id: string; cpf: string }[] = await queryRunner.query(`SELECT "id", "cpf" FROM "teachers" WHERE "cpf" IS NOT NULL`);
        for (const r of rows) {
            await queryRunner.query(
                `UPDATE "teachers" SET "cpf_encrypted" = $1, "cpf_hash" = $2, "cpf_masked" = $3 WHERE "id" = $4`,
                [encryptField(r.cpf), blindIndex(r.cpf, 'cpf'), maskCpf(r.cpf), r.id],
            );
        }
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "cpf"`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "tokens_valid_after" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "mfa_secret_encrypted" text`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "mfa_pending_secret_encrypted" text`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "mfa_enabled_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "mfa_last_step" bigint`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "session_id" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "ip" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "session_started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`CREATE INDEX "IDX_3bf308fa93da3966f9e76fcfba" ON "refresh_tokens" ("session_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_3bf308fa93da3966f9e76fcfba"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "session_started_at"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "ip"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "session_id"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "mfa_last_step"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "mfa_enabled_at"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "mfa_pending_secret_encrypted"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "mfa_secret_encrypted"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "tokens_valid_after"`);
        // Volta o CPF para texto puro antes de apagar as colunas cifradas (sem perda de dado).
        await queryRunner.query(`ALTER TABLE "teachers" ADD "cpf" character varying(11)`);
        const rows: { id: string; cpf_encrypted: string }[] = await queryRunner.query(`SELECT "id", "cpf_encrypted" FROM "teachers" WHERE "cpf_encrypted" IS NOT NULL`);
        for (const r of rows) await queryRunner.query(`UPDATE "teachers" SET "cpf" = $1 WHERE "id" = $2`, [decryptField(r.cpf_encrypted), r.id]);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "cpf_masked"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP CONSTRAINT "UQ_edefc8108ed873672be2b67c934"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "cpf_hash"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "cpf_encrypted"`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD CONSTRAINT "UQ_078d9a8b55bab3710f805cf8fcc" UNIQUE ("cpf")`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0e6b04118c450eb6ce644a2d6f"`);
        await queryRunner.query(`DROP TABLE "mfa_recovery_codes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5171b7179792cf95caf988c881"`);
        await queryRunner.query(`DROP TABLE "security_events"`);
    }

}
