import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingPlan } from '../alunos/entities/billing-plan.entity';
import { Student } from '../alunos/entities/student.entity';
import { Lesson } from '../agenda/entities/lesson.entity';
import { TeachersModule } from '../professor/teachers.module';
import { BillingService } from './billing.service';
import { ChargesService } from './charges.service';
import { Charge } from './entities/charge.entity';
import { Payment } from './entities/payment.entity';
import { FinanceController } from './finance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Charge, Payment, Student, BillingPlan, Lesson]), TeachersModule],
  controllers: [FinanceController],
  providers: [ChargesService, BillingService],
  exports: [ChargesService, BillingService],
})
export class FinanceModule {}
