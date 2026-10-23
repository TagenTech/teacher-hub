import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PixKeyType, type UpdateSettingsRequest } from '@aulinha/contracts';
import { EmptyToNull } from '../../common/validators/br.validators';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class UpdateSettingsDto implements UpdateSettingsRequest {
  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe seu nome' })
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(140)
  pixKey?: string | null;

  @ApiPropertyOptional({ enum: Object.values(PixKeyType) })
  @EmptyToNull()
  @IsOptional()
  @IsIn(Object.values(PixKeyType))
  pixKeyType?: PixKeyType | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  lessonReminderMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  paymentReminderHour?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(300)
  defaultLessonMinutes?: number;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  whatsappTemplate?: string | null;
}
