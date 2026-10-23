import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingPlan } from '../alunos/entities/billing-plan.entity';
import { Student } from '../alunos/entities/student.entity';
import { Lesson } from '../agenda/entities/lesson.entity';
import { Charge } from '../financeiro/entities/charge.entity';
import { Payment } from '../financeiro/entities/payment.entity';
import { TeachersModule } from '../professor/teachers.module';
import { SavedFilter } from './entities/saved-filter.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Student, BillingPlan, Charge, Payment, Lesson, SavedFilter]), TeachersModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
