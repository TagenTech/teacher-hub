import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../alunos/entities/student.entity';
import { Lesson } from '../agenda/entities/lesson.entity';
import { Charge } from '../financeiro/entities/charge.entity';
import { TeachersModule } from '../professor/teachers.module';
import { CalendarService } from './calendar.service';
import { NotificationLog } from './entities/notification-log.entity';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { PushService } from './push.service';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscriptionEntity, NotificationLog, Lesson, Charge, Student]), TeachersModule],
  controllers: [RemindersController],
  providers: [PushService, RemindersService, CalendarService],
  exports: [RemindersService],
})
export class RemindersModule {}
