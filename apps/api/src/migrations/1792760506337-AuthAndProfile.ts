import { MigrationInterface, QueryRunner } from "typeorm";

export class AuthAndProfile1792760506337 implements MigrationInterface {
    name = 'AuthAndProfile1792760506337'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "email_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL, "type" character varying(8) NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_08abb3fa348e894c274a6730d35" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e80345d9689b7c0bafce25dd8f" ON "email_tokens" ("teacher_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8acb431edfc9f9d0e77741468e" ON "email_tokens" ("token_hash") `);
        await queryRunner.query(`CREATE TABLE "auth_identities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL, "provider" character varying(16) NOT NULL, "provider_user_id" character varying(255) NOT NULL, "email" character varying(180), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_63a29aebcddd09448dbeee4666b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3be99fb496b65d45105f84d624" ON "auth_identities" ("teacher_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_aa609852756e5772a11b73f8d8" ON "auth_identities" ("provider", "provider_user_id") `);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "email_verified_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "cpf" character varying(11)`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD CONSTRAINT "UQ_078d9a8b55bab3710f805cf8fcc" UNIQUE ("cpf")`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "phone" character varying(11)`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "city" character varying(80)`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "state" character varying(2)`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "terms_accepted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD "profile_completed_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "teachers" ALTER COLUMN "password_hash" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "auth_identities" ADD CONSTRAINT "FK_3be99fb496b65d45105f84d624a" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
            // Contas criadas antes do cadastro público (pelo administrador) já são confiáveis.
        await queryRunner.query(`UPDATE "teachers" SET "email_verified_at" = "created_at", "terms_accepted_at" = "created_at" WHERE "email_verified_at" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth_identities" DROP CONSTRAINT "FK_3be99fb496b65d45105f84d624a"`);
        await queryRunner.query(`ALTER TABLE "teachers" ALTER COLUMN "password_hash" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "profile_completed_at"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "terms_accepted_at"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "state"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "city"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "phone"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP CONSTRAINT "UQ_078d9a8b55bab3710f805cf8fcc"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "cpf"`);
        await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "email_verified_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa609852756e5772a11b73f8d8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3be99fb496b65d45105f84d624"`);
        await queryRunner.query(`DROP TABLE "auth_identities"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8acb431edfc9f9d0e77741468e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e80345d9689b7c0bafce25dd8f"`);
        await queryRunner.query(`DROP TABLE "email_tokens"`);
    }

}
