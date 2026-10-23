import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingPlan } from '../alunos/entities/billing-plan.entity';
import { Student } from '../alunos/entities/student.entity';
import { TeachersModule } from '../professor/teachers.module';
import { AgendaController } from './agenda.controller';
import { BlocksService } from './blocks.service';
import { Lesson } from './entities/lesson.entity';
import { MakeupCredit } from './entities/makeup-credit.entity';
import { RecurringSlot } from './entities/recurring-slot.entity';
import { ScheduleBlock } from './entities/schedule-block.entity';
import { LessonsService } from './lessons.service';
import { SlotsService } from './slots.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecurringSlot, Lesson, MakeupCredit, ScheduleBlock, Student, BillingPlan]),
    TeachersModule,
  ],
  controllers: [AgendaController],
  providers: [SlotsService, LessonsService, BlocksService],
  exports: [SlotsService, LessonsService],
})
export class AgendaModule {}
