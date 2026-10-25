import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1792891608703 implements MigrationInterface {
    name = 'InitialSchema1792891608703'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "turmei_security_events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "teacher_id" uuid, "type" character varying(32) NOT NULL, "ip" character varying(64), "user_agent" character varying(255), "meta" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_150c20a4c76c51296d6ef1a4a4c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1559cd65e4557def02590d4b38" ON "turmei_security_events" ("teacher_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "turmei_saved_filters" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "teacher_id" uuid NOT NULL, "name" character varying(60) NOT NULL, "scope" character varying(20) NOT NULL, "period" character varying(20) NOT NULL, "criteria" jsonb NOT NULL, "pinned" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5f565afd9de2ed53216201ddbac" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_506b32cc334a7d0dc6b1b4f5bd" ON "turmei_saved_filters" ("teacher_id", "scope") `);
        await queryRunner.query(`CREATE TABLE "turmei_teachers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(120) NOT NULL, "email" character varying(180) NOT NULL, "password_hash" character varying, "email_verified_at" TIMESTAMP WITH TIME ZONE, "cpf_encrypted" text, "cpf_hash" character varying(64), "cpf_masked" character varying(14), "phone" character varying(11), "city" character varying(80), "state" character varying(2), "terms_accepted_at" TIMESTAMP WITH TIME ZONE, "profile_completed_at" TIMESTAMP WITH TIME ZONE, "tokens_valid_after" TIMESTAMP WITH TIME ZONE, "mfa_secret_encrypted" text, "mfa_pending_secret_encrypted" text, "mfa_enabled_at" TIMESTAMP WITH TIME ZONE, "mfa_last_step" bigint, "timezone" character varying(64) NOT NULL DEFAULT 'America/Sao_Paulo', "pix_key" character varying(140), "pix_key_type" character varying(16), "lesson_reminder_minutes" integer NOT NULL DEFAULT '30', "payment_reminder_hour" integer NOT NULL DEFAULT '9', "default_lesson_minutes" integer NOT NULL DEFAULT '60', "whatsapp_template" text, "ics_token" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_fa1055496200f91890665a2af64" UNIQUE ("email"), CONSTRAINT "UQ_95f298c128c58675c6430c44a15" UNIQUE ("cpf_hash"), CONSTRAINT "UQ_460c9cb1bd1f43f30eac65fbd9f" UNIQUE ("ics_token"), CONSTRAINT "PK_11bfcce73e92529e4947c2650f0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "turmei_push_subscriptions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "teacher_id" uuid NOT NULL, "endpoint" text NOT NULL, "p256dh" character varying(200) NOT NULL, "auth" character varying(100) NOT NULL, "device_label" character varying(120), "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9f7bfade2fa0e512749d00100ca" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_beecb77561e1ece04ebaa11270" ON "turmei_push_subscriptions" ("teacher_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_967db5445035cdb5386f7cefa8" ON "turmei_push_subscriptions" ("endpoint") `);
        await queryRunner.query(`CREATE TABLE "turmei_notification_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "teacher_id" uuid NOT NULL, "type" character varying(24) NOT NULL, "ref_id" character varying(64) NOT NULL, "key" character varying(40) NOT NULL, "sent_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_56dc208341bda88fad08e69e2c3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_bbf3a24215505cfe72665427a7" ON "turmei_notification_logs" ("type", "ref_id", "key") `);
        await queryRunner.query(`CREATE TABLE "turmei_billing_plans" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "teacher_id" uuid NOT NULL, "student_id" uuid NOT NULL, "type" character varying(16) NOT NULL, "monthly_fee_cents" integer, "lesson_price_cents" integer, "package_lessons" integer, "package_price_cents" integer, "due_day" smallint, "note" character varying(200), "valid_from" date NOT NULL, "valid_to" date, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a4e412d7bf4d34c040b00c133bb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0ce4aa966bbb5f8ffd48fdcb61" ON "turmei_billing_plans" ("student_id", "valid_from") `);
        await queryRunner.query(`CREATE TABLE "turmei_students" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "teacher_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "nickname" character varying(40), "phone" character varying(11), "email" character varying(180), "birth_date" date, "guardian_name" character varying(120), "guardian_phone" character varying(11), "payer_is_guardian" boolean NOT NULL DEFAULT false, "color" character varying(16) NOT NULL DEFAULT 'lavanda', "emoji" character varying(16), "status" character varying(16) NOT NULL DEFAULT 'ATIVO', "paused_until" date, "start_date" date NOT NULL, "tags" text array NOT NULL DEFAULT '{}', "notes" text, "search_text" text NOT NULL DEFAULT '', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ec76d2b950fe35db5b1900a5b84" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b1b7b7e23801acf9d93ca7fcc1" ON "turmei_students" ("teacher_id", "status") `);
        await queryRunner.query(`CREATE TABLE "turmei_charges" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "teacher_id" uuid NOT NULL, "student_id" uuid NOT NULL, "kind" character varying(16) NOT NULL, "reference_month" character varying(7), "description" character varying(160) NOT NULL, "amount_cents" integer NOT NULL, "discount_cents" integer NOT NULL DEFAULT '0', "due_date" date NOT NULL, "canceled_at" TIMESTAMP WITH TIME ZONE, "plan_id" uuid, "package_lessons" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2716338284ccc7dfa32c4421050" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9de22ab990c45a56dbf4ef121a" ON "turmei_charges" ("student_id", "kind", "reference_month") WHERE "reference_month" IS NOT NULL AND "kind" IN ('MENSALIDADE', 'AULAS_DO_MES')`);
        await queryRunner.query(`CREATE INDEX "IDX_b2f604be7c1c6230fc9106d14e" ON "turmei_charges" ("teacher_id", "due_date") `);
        await queryRunner.query(`CREATE TABLE "turmei_payments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "teacher_id" uuid NOT NULL, "charge_id" uuid NOT NULL, "amount_cents" integer NOT NULL, "paid_at" date NOT NULL, "method" character varying(16) NOT NULL, "note" character varying(200), "receipt_number" character varying(20) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8e89ba861fbc4a0e2ceea6229d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_96b966f23cb2fe750c9100aaca" ON "turmei_payments" ("teacher_id", "paid_at") `);
        await queryRunner.query(`CREATE TABLE "turmei_refresh_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "teacher_id" uuid NOT NULL, "session_id" uuid NOT NULL DEFAULT gen_random_uuid(), "ip" character varying(64), "session_started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "user_agent" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0772c7c25ac3ebf6884744e97c6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1e6b2b032367b3cfe5ec50a450" ON "turmei_refresh_tokens" ("teacher_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2dd89b3c29cab518d42b3bb4f0" ON "turmei_refresh_tokens" ("session_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_768f4381abac14d954e4d9a4ed" ON "turmei_refresh_tokens" ("token_hash") `);
        await queryRunner.query(`CREATE TABLE "turmei_mfa_recovery_codes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "teacher_id" uuid NOT NULL, "code_hash" character varying(64) NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3d3e05e00a415599ed9ecd3e900" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2bbfd22b7670427e6fc58ef603" ON "turmei_mfa_recovery_codes" ("teacher_id") `);
        await queryRunner.query(`CREATE TABLE "turmei_email_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "teacher_id" uuid NOT NULL, "type" character varying(8) NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a6bc3a96124d3ecd1987ebea307" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9275d09e0a0103be59a1580ff0" ON "turmei_email_tokens" ("teacher_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b6f45e1b8997460f08e1e40335" ON "turmei_email_tokens" ("token_hash") `);
        await queryRunner.query(`CREATE TABLE "turmei_auth_identities" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "teacher_id" uuid NOT NULL, "provider" character varying(16) NOT NULL, "provider_user_id" character varying(255) NOT NULL, "email" character varying(180), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e0da1f3170dcfe7ead8db4d61b5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_09eeff552322ace5263ac65530" ON "turmei_auth_identities" ("teacher_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8ee768603774a7d63676b3c081" ON "turmei_auth_identities" ("provider", "provider_user_id") `);
        await queryRunner.query(`CREATE TABLE "turmei_schedule_blocks" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "teacher_id" uuid NOT NULL, "start_date" date NOT NULL, "end_date" date NOT NULL, "reason" character varying(120) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1a197d613e4a1382d1225c65ff2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1863f4d52acf6bcd7c1d152706" ON "turmei_schedule_blocks" ("teacher_id", "start_date") `);
        await queryRunner.query(`CREATE TABLE "turmei_recurring_slots" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "teacher_id" uuid NOT NULL, "student_id" uuid NOT NULL, "weekday" smallint NOT NULL, "start_time" character varying(5) NOT NULL, "duration_min" smallint NOT NULL, "mode" character varying(16) NOT NULL, "location" character varying(200), "meeting_url" character varying(500), "valid_from" date NOT NULL, "valid_to" date, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_77fb09013f97844e003f7df918a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5cdbb78f883162454b0e916809" ON "turmei_recurring_slots" ("teacher_id", "student_id") `);
        await queryRunner.query(`CREATE TABLE "turmei_makeup_credits" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "teacher_id" uuid NOT NULL, "student_id" uuid NOT NULL, "origin_lesson_id" uuid, "reason" character varying(300), "status" character varying(16) NOT NULL DEFAULT 'ABERTO', "used_lesson_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d42ac279699192e89c996fe43d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c9e39991cadba90668fad36aa8" ON "turmei_makeup_credits" ("teacher_id", "status") `);
        await queryRunner.query(`CREATE TABLE "turmei_lessons" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "teacher_id" uuid NOT NULL, "student_id" uuid NOT NULL, "slot_id" uuid, "occurrence_date" date, "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'AGENDADA', "mode" character varying(16) NOT NULL, "location" character varying(200), "meeting_url" character varying(500), "justified" boolean NOT NULL DEFAULT false, "absence_reason" character varying(300), "chargeable" boolean NOT NULL DEFAULT true, "price_cents" integer, "content" text, "homework" text, "makeup_credit_id" uuid, "rescheduled_from_id" uuid, "block_id" uuid, "charge_id" uuid, "marked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_78b2ea2231d70e36f822cbfe641" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_855e0e8cfa67073539c7bcbeff" ON "turmei_lessons" ("charge_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_697b959da3d95b48ecbf69f40a" ON "turmei_lessons" ("slot_id", "occurrence_date") WHERE "slot_id" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_4aa6d953b68588dacc8353a2d0" ON "turmei_lessons" ("student_id", "starts_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_ee9094ef69b83fb26787b6c9ef" ON "turmei_lessons" ("teacher_id", "starts_at") `);
        await queryRunner.query(`ALTER TABLE "turmei_billing_plans" ADD CONSTRAINT "FK_8621caa6de10db98bca1f245bc8" FOREIGN KEY ("student_id") REFERENCES "turmei_students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "turmei_charges" ADD CONSTRAINT "FK_1bac149422de724d0a6fec3f224" FOREIGN KEY ("student_id") REFERENCES "turmei_students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "turmei_payments" ADD CONSTRAINT "FK_ce517bd7cb1b19794084d99b895" FOREIGN KEY ("charge_id") REFERENCES "turmei_charges"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "turmei_auth_identities" ADD CONSTRAINT "FK_09eeff552322ace5263ac65530b" FOREIGN KEY ("teacher_id") REFERENCES "turmei_teachers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "turmei_recurring_slots" ADD CONSTRAINT "FK_020dfe61b3bd49f9ef2ced81857" FOREIGN KEY ("student_id") REFERENCES "turmei_students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "turmei_makeup_credits" ADD CONSTRAINT "FK_fd490f690541b2aaf09056e3bc3" FOREIGN KEY ("student_id") REFERENCES "turmei_students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "turmei_lessons" ADD CONSTRAINT "FK_7c25af0da61aed12a2ae4eedc9d" FOREIGN KEY ("student_id") REFERENCES "turmei_students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "turmei_lessons" DROP CONSTRAINT "FK_7c25af0da61aed12a2ae4eedc9d"`);
        await queryRunner.query(`ALTER TABLE "turmei_makeup_credits" DROP CONSTRAINT "FK_fd490f690541b2aaf09056e3bc3"`);
        await queryRunner.query(`ALTER TABLE "turmei_recurring_slots" DROP CONSTRAINT "FK_020dfe61b3bd49f9ef2ced81857"`);
        await queryRunner.query(`ALTER TABLE "turmei_auth_identities" DROP CONSTRAINT "FK_09eeff552322ace5263ac65530b"`);
        await queryRunner.query(`ALTER TABLE "turmei_payments" DROP CONSTRAINT "FK_ce517bd7cb1b19794084d99b895"`);
        await queryRunner.query(`ALTER TABLE "turmei_charges" DROP CONSTRAINT "FK_1bac149422de724d0a6fec3f224"`);
        await queryRunner.query(`ALTER TABLE "turmei_billing_plans" DROP CONSTRAINT "FK_8621caa6de10db98bca1f245bc8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ee9094ef69b83fb26787b6c9ef"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4aa6d953b68588dacc8353a2d0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_697b959da3d95b48ecbf69f40a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_855e0e8cfa67073539c7bcbeff"`);
        await queryRunner.query(`DROP TABLE "turmei_lessons"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c9e39991cadba90668fad36aa8"`);
        await queryRunner.query(`DROP TABLE "turmei_makeup_credits"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5cdbb78f883162454b0e916809"`);
        await queryRunner.query(`DROP TABLE "turmei_recurring_slots"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1863f4d52acf6bcd7c1d152706"`);
        await queryRunner.query(`DROP TABLE "turmei_schedule_blocks"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ee768603774a7d63676b3c081"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_09eeff552322ace5263ac65530"`);
        await queryRunner.query(`DROP TABLE "turmei_auth_identities"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b6f45e1b8997460f08e1e40335"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9275d09e0a0103be59a1580ff0"`);
        await queryRunner.query(`DROP TABLE "turmei_email_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2bbfd22b7670427e6fc58ef603"`);
        await queryRunner.query(`DROP TABLE "turmei_mfa_recovery_codes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_768f4381abac14d954e4d9a4ed"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2dd89b3c29cab518d42b3bb4f0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1e6b2b032367b3cfe5ec50a450"`);
        await queryRunner.query(`DROP TABLE "turmei_refresh_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_96b966f23cb2fe750c9100aaca"`);
        await queryRunner.query(`DROP TABLE "turmei_payments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b2f604be7c1c6230fc9106d14e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9de22ab990c45a56dbf4ef121a"`);
        await queryRunner.query(`DROP TABLE "turmei_charges"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b1b7b7e23801acf9d93ca7fcc1"`);
        await queryRunner.query(`DROP TABLE "turmei_students"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0ce4aa966bbb5f8ffd48fdcb61"`);
        await queryRunner.query(`DROP TABLE "turmei_billing_plans"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bbf3a24215505cfe72665427a7"`);
        await queryRunner.query(`DROP TABLE "turmei_notification_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_967db5445035cdb5386f7cefa8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_beecb77561e1ece04ebaa11270"`);
        await queryRunner.query(`DROP TABLE "turmei_push_subscriptions"`);
        await queryRunner.query(`DROP TABLE "turmei_teachers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_506b32cc334a7d0dc6b1b4f5bd"`);
        await queryRunner.query(`DROP TABLE "turmei_saved_filters"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1559cd65e4557def02590d4b38"`);
        await queryRunner.query(`DROP TABLE "turmei_security_events"`);
    }

}
