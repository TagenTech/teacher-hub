import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1792734570400 implements MigrationInterface {
    name = 'InitialSchema1792734570400'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "saved_filters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL, "name" character varying(60) NOT NULL, "scope" character varying(20) NOT NULL, "period" character varying(20) NOT NULL, "criteria" jsonb NOT NULL, "pinned" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d30e30ca883a3bd014c9ed983ac" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_073d884c6d7cd901eeca8bdfe3" ON "saved_filters" ("teacher_id", "scope") `);
        await queryRunner.query(`CREATE TABLE "teachers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "email" character varying(180) NOT NULL, "password_hash" character varying NOT NULL, "timezone" character varying(64) NOT NULL DEFAULT 'America/Sao_Paulo', "pix_key" character varying(140), "pix_key_type" character varying(16), "lesson_reminder_minutes" integer NOT NULL DEFAULT '30', "payment_reminder_hour" integer NOT NULL DEFAULT '9', "default_lesson_minutes" integer NOT NULL DEFAULT '60', "whatsapp_template" text, "ics_token" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_7568c49a630907119e4a665c605" UNIQUE ("email"), CONSTRAINT "UQ_7202bc40e3d82e9f15eeccd7938" UNIQUE ("ics_token"), CONSTRAINT "PK_a8d4f83be3abe4c687b0a0093c8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "push_subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL, "endpoint" text NOT NULL, "p256dh" character varying(200) NOT NULL, "auth" character varying(100) NOT NULL, "device_label" character varying(120), "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_757fc8f00c34f66832668dc2e53" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_40f8c13c0ff560168d639d05a6" ON "push_subscriptions" ("teacher_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0008bdfd174e533a3f98bf9af1" ON "push_subscriptions" ("endpoint") `);
        await queryRunner.query(`CREATE TABLE "notification_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL, "type" character varying(24) NOT NULL, "ref_id" character varying(64) NOT NULL, "key" character varying(40) NOT NULL, "sent_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_19c524e644cdeaebfcffc284871" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_cc8448979801c457fb87a9864e" ON "notification_logs" ("type", "ref_id", "key") `);
        await queryRunner.query(`CREATE TABLE "billing_plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL, "student_id" uuid NOT NULL, "type" character varying(16) NOT NULL, "monthly_fee_cents" integer, "lesson_price_cents" integer, "package_lessons" integer, "package_price_cents" integer, "due_day" smallint, "note" character varying(200), "valid_from" date NOT NULL, "valid_to" date, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f5dd8c47fbdcd68a43b97f9795e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_921d361bab14dfe5287ae6e5d2" ON "billing_plans" ("student_id", "valid_from") `);
        await queryRunner.query(`CREATE TABLE "students" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "nickname" character varying(40), "phone" character varying(11), "email" character varying(180), "birth_date" date, "guardian_name" character varying(120), "guardian_phone" character varying(11), "payer_is_guardian" boolean NOT NULL DEFAULT false, "color" character varying(16) NOT NULL DEFAULT 'lavanda', "emoji" character varying(16), "status" character varying(16) NOT NULL DEFAULT 'ATIVO', "paused_until" date, "start_date" date NOT NULL, "tags" text array NOT NULL DEFAULT '{}', "notes" text, "search_text" text NOT NULL DEFAULT '', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7d7f07271ad4ce999880713f05e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_15c3d814bb7585f99966c4299d" ON "students" ("teacher_id", "status") `);
        await queryRunner.query(`CREATE TABLE "charges" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL, "student_id" uuid NOT NULL, "kind" character varying(16) NOT NULL, "reference_month" character varying(7), "description" character varying(160) NOT NULL, "amount_cents" integer NOT NULL, "discount_cents" integer NOT NULL DEFAULT '0', "due_date" date NOT NULL, "canceled_at" TIMESTAMP WITH TIME ZONE, "plan_id" uuid, "package_lessons" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0c6feb10df0fa460714f8464dce" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_05e1f5cc82bd461bfdf73eaab4" ON "charges" ("student_id", "kind", "reference_month") WHERE "reference_month" IS NOT NULL AND "kind" IN ('MENSALIDADE', 'AULAS_DO_MES')`);
        await queryRunner.query(`CREATE INDEX "IDX_792d980d4456b47759c649126d" ON "charges" ("teacher_id", "due_date") `);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL, "charge_id" uuid NOT NULL, "amount_cents" integer NOT NULL, "paid_at" date NOT NULL, "method" character varying(16) NOT NULL, "note" character varying(200), "receipt_number" character varying(20) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dfea0f1664240d75c245d1461c" ON "payments" ("teacher_id", "paid_at") `);
        await queryRunner.query(`CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "user_agent" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fc28bc36302ea0f2d31b6f3d8f" ON "refresh_tokens" ("teacher_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a7838d2ba25be1342091b6695f" ON "refresh_tokens" ("token_hash") `);
        await queryRunner.query(`CREATE TABLE "schedule_blocks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL, "start_date" date NOT NULL, "end_date" date NOT NULL, "reason" character varying(120) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_be208e77d069119d327394eeedf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1165957c865cc075431d449b34" ON "schedule_blocks" ("teacher_id", "start_date") `);
        await queryRunner.query(`CREATE TABLE "recurring_slots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL, "student_id" uuid NOT NULL, "weekday" smallint NOT NULL, "start_time" character varying(5) NOT NULL, "duration_min" smallint NOT NULL, "mode" character varying(16) NOT NULL, "location" character varying(200), "meeting_url" character varying(500), "valid_from" date NOT NULL, "valid_to" date, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_49a145de4943286571a0fefa3a8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_737fb0ff6fb6d1a42c57bb7900" ON "recurring_slots" ("teacher_id", "student_id") `);
        await queryRunner.query(`CREATE TABLE "makeup_credits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL, "student_id" uuid NOT NULL, "origin_lesson_id" uuid, "reason" character varying(300), "status" character varying(16) NOT NULL DEFAULT 'ABERTO', "used_lesson_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7f0ccf26b1c23e59ee91254e99c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f00ad2329fb9dbc3d0c3895b4a" ON "makeup_credits" ("teacher_id", "status") `);
        await queryRunner.query(`CREATE TABLE "lessons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_id" uuid NOT NULL, "student_id" uuid NOT NULL, "slot_id" uuid, "occurrence_date" date, "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'AGENDADA', "mode" character varying(16) NOT NULL, "location" character varying(200), "meeting_url" character varying(500), "justified" boolean NOT NULL DEFAULT false, "absence_reason" character varying(300), "chargeable" boolean NOT NULL DEFAULT true, "price_cents" integer, "content" text, "homework" text, "makeup_credit_id" uuid, "rescheduled_from_id" uuid, "block_id" uuid, "charge_id" uuid, "marked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9b9a8d455cac672d262d7275730" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5f2acba62ae605c6629a982fc7" ON "lessons" ("charge_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0aa82284ba263a22edcef781b1" ON "lessons" ("slot_id", "occurrence_date") WHERE "slot_id" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_8a1c344e9a710f0c2c96916489" ON "lessons" ("student_id", "starts_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_5d24255c29b38ccff01bd7d7aa" ON "lessons" ("teacher_id", "starts_at") `);
        await queryRunner.query(`ALTER TABLE "billing_plans" ADD CONSTRAINT "FK_5a889760ebdde3ee041609e9a42" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "charges" ADD CONSTRAINT "FK_64b060ff8499a59f8803f7ae83a" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_530e4ff65de610227bed7a305d6" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "recurring_slots" ADD CONSTRAINT "FK_386db33da5cfc2926157c1f86f1" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "makeup_credits" ADD CONSTRAINT "FK_1a17b2fdb177c875c0c325f726e" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lessons" ADD CONSTRAINT "FK_3bc5bfec4b380597fc4e0042e1b" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lessons" DROP CONSTRAINT "FK_3bc5bfec4b380597fc4e0042e1b"`);
        await queryRunner.query(`ALTER TABLE "makeup_credits" DROP CONSTRAINT "FK_1a17b2fdb177c875c0c325f726e"`);
        await queryRunner.query(`ALTER TABLE "recurring_slots" DROP CONSTRAINT "FK_386db33da5cfc2926157c1f86f1"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_530e4ff65de610227bed7a305d6"`);
        await queryRunner.query(`ALTER TABLE "charges" DROP CONSTRAINT "FK_64b060ff8499a59f8803f7ae83a"`);
        await queryRunner.query(`ALTER TABLE "billing_plans" DROP CONSTRAINT "FK_5a889760ebdde3ee041609e9a42"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5d24255c29b38ccff01bd7d7aa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8a1c344e9a710f0c2c96916489"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0aa82284ba263a22edcef781b1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5f2acba62ae605c6629a982fc7"`);
        await queryRunner.query(`DROP TABLE "lessons"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f00ad2329fb9dbc3d0c3895b4a"`);
        await queryRunner.query(`DROP TABLE "makeup_credits"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_737fb0ff6fb6d1a42c57bb7900"`);
        await queryRunner.query(`DROP TABLE "recurring_slots"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1165957c865cc075431d449b34"`);
        await queryRunner.query(`DROP TABLE "schedule_blocks"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a7838d2ba25be1342091b6695f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fc28bc36302ea0f2d31b6f3d8f"`);
        await queryRunner.query(`DROP TABLE "refresh_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dfea0f1664240d75c245d1461c"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_792d980d4456b47759c649126d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_05e1f5cc82bd461bfdf73eaab4"`);
        await queryRunner.query(`DROP TABLE "charges"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_15c3d814bb7585f99966c4299d"`);
        await queryRunner.query(`DROP TABLE "students"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_921d361bab14dfe5287ae6e5d2"`);
        await queryRunner.query(`DROP TABLE "billing_plans"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cc8448979801c457fb87a9864e"`);
        await queryRunner.query(`DROP TABLE "notification_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0008bdfd174e533a3f98bf9af1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_40f8c13c0ff560168d639d05a6"`);
        await queryRunner.query(`DROP TABLE "push_subscriptions"`);
        await queryRunner.query(`DROP TABLE "teachers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_073d884c6d7cd901eeca8bdfe3"`);
        await queryRunner.query(`DROP TABLE "saved_filters"`);
    }

}
