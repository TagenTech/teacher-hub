import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  LessonMode,
  LessonStatus,
  type AttendanceRequest,
  type CreateLessonRequest,
  type CreateScheduleBlockRequest,
  type CreateSlotRequest,
  type RescheduleRequest,
  type UpdateLessonRequest,
  type UpdateSlotRequest,
} from '@turmei/contracts';
import { EmptyToNull, IsIsoDate } from '../../common/validators/br.validators';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

class LessonPlaceDto {
  @ApiProperty({ enum: Object.values(LessonMode) })
  @IsIn(Object.values(LessonMode), { message: 'Escolha presencial ou online' })
  mode: LessonMode;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'Link inválido (comece com https://)' })
  @MaxLength(500)
  meetingUrl?: string | null;
}

export class SlotInputDto extends LessonPlaceDto {
  @ApiProperty({ minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @ApiProperty({ example: '19:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Horário inválido' })
  startTime: string;

  @ApiProperty({ example: 60 })
  @IsInt()
  @Min(15, { message: 'Duração mínima de 15 minutos' })
  @Max(300)
  durationMin: number;
}

export class CreateSlotDto extends SlotInputDto implements CreateSlotRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIsoDate()
  validFrom?: string;
}

export class UpdateSlotDto extends SlotInputDto implements UpdateSlotRequest {
  @ApiProperty()
  @IsIsoDate()
  effectiveFrom: string;
}

export class EndSlotQueryDto {
  @ApiProperty({ description: 'Último dia passa a ser o anterior a esta data' })
  @IsIsoDate()
  from: string;
}

export class ListLessonsQueryDto {
  @ApiProperty()
  @IsIsoDate()
  from: string;

  @ApiProperty()
  @IsIsoDate()
  to: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  studentId?: string;
}

export class CreateLessonDto extends LessonPlaceDto implements CreateLessonRequest {
  @ApiProperty()
  @IsUUID('4', { message: 'Escolha o aluno' })
  studentId: string;

  @ApiProperty()
  @IsISO8601({ strict: true }, { message: 'Data/hora inválida' })
  startsAt: string;

  @ApiProperty()
  @IsInt()
  @Min(15)
  @Max(300)
  durationMin: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  makeupCreditId?: string | null;
}

export class UpdateLessonDto implements UpdateLessonRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(300)
  durationMin?: number;

  @ApiPropertyOptional({ enum: Object.values(LessonMode) })
  @IsOptional()
  @IsIn(Object.values(LessonMode))
  mode?: LessonMode;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'Link inválido (comece com https://)' })
  meetingUrl?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  homework?: string | null;
}

export class AttendanceDto implements AttendanceRequest {
  @ApiProperty({ enum: Object.values(LessonStatus) })
  @IsIn(
    [LessonStatus.AGENDADA, LessonStatus.REALIZADA, LessonStatus.FALTA_ALUNO, LessonStatus.FALTA_PROFESSOR, LessonStatus.CANCELADA],
    { message: 'Situação inválida' },
  )
  status: LessonStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  justified?: boolean;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  chargeable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  createMakeup?: boolean;
}

export class RescheduleDto implements RescheduleRequest {
  @ApiProperty()
  @IsISO8601({ strict: true }, { message: 'Data/hora inválida' })
  startsAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(300)
  durationMin?: number;
}

export class CreateScheduleBlockDto implements CreateScheduleBlockRequest {
  @ApiProperty()
  @IsIsoDate()
  startDate: string;

  @ApiProperty()
  @IsIsoDate()
  endDate: string;

  @ApiProperty({ example: 'Feriado' })
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Dê um nome ao bloqueio' })
  @MaxLength(120)
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  createMakeups?: boolean;
}

export class ListMakeupQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['ABERTO', 'USADO', 'CANCELADO'])
  status?: string;
}
