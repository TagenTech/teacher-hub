import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AgendaModule } from './agenda/agenda.module';
import { FinanceModule } from './financeiro/finance.module';
import { RemindersModule } from './lembretes/reminders.module';
import { ReportsModule } from './relatorios/reports.module';
import { StudentsModule } from './alunos/students.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import configuration, { AppConfig } from './config/configuration';
import { HealthController } from './health.controller';
import { MailModule } from './mail/mail.module';
import { SecurityModule } from './security/security.module';
import { TeachersModule } from './professor/teachers.module';
import { getDatabaseOptions } from './database/db-options';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [join(__dirname, '..', '.env.local'), join(__dirname, '..', '.env')],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    ...(process.env.SCHEDULER_ENABLED !== 'false' ? [ScheduleModule.forRoot()] : []),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...getDatabaseOptions(config.get<AppConfig['databaseUrl']>('databaseUrl')!),
        autoLoadEntities: true,
        synchronize: config.get<boolean>('typeormSync'),
        // Produção: schema só muda por migration, aplicada na subida da API.
        migrationsRun: !config.get<boolean>('typeormSync') && process.env.TYPEORM_MIGRATIONS_RUN !== 'false',
      }),
    }),
    MailModule,
    SecurityModule,
    AuthModule,
    TeachersModule,
    StudentsModule,
    AgendaModule,
    FinanceModule,
    RemindersModule,
    ReportsModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
