import { Module } from '@nestjs/common';
import { AgendaModule } from '../agenda/agenda.module';
import { StudentsModule } from '../alunos/students.module';
import { FinanceModule } from '../financeiro/finance.module';
import { RemindersModule } from '../lembretes/reminders.module';
import { SecurityModule } from '../security/security.module';
import { JobsController } from './jobs.controller';

@Module({
  imports: [RemindersModule, AgendaModule, StudentsModule, FinanceModule, SecurityModule],
  controllers: [JobsController],
})
export class JobsModule {}
