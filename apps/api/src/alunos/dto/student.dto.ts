import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  normalizeTag,
  STUDENT_COLORS,
  STUDENT_LIMITS,
  StudentStatus,
  type ChangeStudentStatusRequest,
  type CreateStudentRequest,
  type StudentColor,
  type StudentFields,
} from '@aulinha/contracts';
import { EmptyToNull, IsBrPhone, IsIsoDate } from '../../common/validators/br.validators';
import { BillingPlanInputDto } from './billing-plan.dto';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class StudentFieldsDto implements StudentFields {
  @ApiProperty({ example: 'Ana Clara Souza' })
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do aluno' })
  @MaxLength(STUDENT_LIMITS.name)
  name: string;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(STUDENT_LIMITS.nickname)
  nickname?: string | null;

  @ApiPropertyOptional({ example: '(11) 98765-4321' })
  @IsOptional()
  @IsBrPhone()
  phone?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(STUDENT_LIMITS.email)
  email?: string | null;

  @ApiPropertyOptional({ example: '2012-05-20' })
  @EmptyToNull()
  @IsOptional()
  @IsIsoDate({ message: 'Data de nascimento inválida' })
  birthDate?: string | null;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(STUDENT_LIMITS.name)
  guardianName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBrPhone({ message: 'Telefone do responsável inválido' })
  guardianPhone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  payerIsGuardian?: boolean;

  @ApiPropertyOptional({ enum: STUDENT_COLORS })
  @IsOptional()
  @IsIn(STUDENT_COLORS as readonly string[], { message: 'Cor inválida' })
  color?: StudentColor;

  @ApiPropertyOptional({ example: '🎹' })
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  emoji?: string | null;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsIsoDate({ message: 'Data de início inválida' })
  startDate?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? [...new Set(value.filter((t) => typeof t === 'string').map(normalizeTag).filter(Boolean))]
      : value,
  )
  @IsString({ each: true })
  @ArrayMaxSize(STUDENT_LIMITS.tags, { message: `Use no máximo ${STUDENT_LIMITS.tags} etiquetas` })
  tags?: string[];

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(STUDENT_LIMITS.notes)
  notes?: string | null;
}

export class CreateStudentDto extends StudentFieldsDto implements CreateStudentRequest {
  @ApiProperty({ type: BillingPlanInputDto })
  @ValidateNested()
  @Type(() => BillingPlanInputDto)
  plan: BillingPlanInputDto;
}

export class UpdateStudentDto extends PartialType(StudentFieldsDto) {}

export class ChangeStudentStatusDto implements ChangeStudentStatusRequest {
  @ApiProperty({ enum: Object.values(StudentStatus) })
  @IsIn(Object.values(StudentStatus), { message: 'Status inválido' })
  status: StudentStatus;

  @ApiPropertyOptional({ example: '2027-01-15' })
  @EmptyToNull()
  @IsOptional()
  @IsIsoDate()
  pausedUntil?: string | null;
}

export class ListStudentsQueryDto {
  @ApiPropertyOptional({ enum: Object.values(StudentStatus) })
  @IsOptional()
  @IsIn(Object.values(StudentStatus))
  status?: StudentStatus;

  @ApiPropertyOptional({ description: 'Busca por nome, apelido, telefone ou etiqueta' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}
