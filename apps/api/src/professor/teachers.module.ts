import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthIdentity } from '../auth/entities/auth-identity.entity';
import { Teacher } from './entities/teacher.entity';
import { TeachersController } from './teachers.controller';
import { ExportService } from './export.service';
import { TeachersService } from './teachers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Teacher, AuthIdentity])],
  controllers: [TeachersController],
  providers: [TeachersService, ExportService],
  exports: [TeachersService],
})
export class TeachersModule {}
