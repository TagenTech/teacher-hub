import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Teacher } from '../professor/entities/teacher.entity';
import { SecurityEvent } from './entities/security-event.entity';
import { SecurityEventsService } from './security-events.service';
import { SessionRevocationService } from './session-revocation.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SecurityEvent, Teacher])],
  providers: [SecurityEventsService, SessionRevocationService],
  exports: [SecurityEventsService, SessionRevocationService],
})
export class SecurityModule {}
