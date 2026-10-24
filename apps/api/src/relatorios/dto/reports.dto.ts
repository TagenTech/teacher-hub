import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { BillingPlanType, PaymentMethod, type ReportFilters, type SaveFilterRequest } from '@turmei/contracts';
import { IsIsoDate } from '../../common/validators/br.validators';

/** Aceita "a,b,c" ou ?x=a&x=b. */
const list = () =>
  Transform(({ value }) =>
    value === undefined || value === '' ? undefined : (Array.isArray(value) ? value : String(value).split(',')).filter(Boolean),
  );

export class ReportQueryDto implements ReportFilters {
  @ApiProperty({ example: '2026-01-01' })
  @IsIsoDate()
  from: string;

  @ApiProperty({ example: '2026-12-31' })
  @IsIsoDate()
  to: string;

  @ApiPropertyOptional({ type: [String] })
  @list()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  studentIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @list()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: Object.values(PaymentMethod), isArray: true })
  @list()
  @IsOptional()
  @IsArray()
  @IsIn(Object.values(PaymentMethod), { each: true })
  methods?: PaymentMethod[];

  @ApiPropertyOptional({ enum: Object.values(BillingPlanType), isArray: true })
  @list()
  @IsOptional()
  @IsArray()
  @IsIn(Object.values(BillingPlanType), { each: true })
  planTypes?: BillingPlanType[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  onlyLate?: boolean;
}

export class ExportQueryDto extends ReportQueryDto {
  @ApiProperty({ enum: ['pagamentos', 'cobrancas', 'aulas', 'atrasos', 'frequencia'] })
  @IsIn(['pagamentos', 'cobrancas', 'aulas', 'atrasos', 'frequencia'])
  type: 'pagamentos' | 'cobrancas' | 'aulas' | 'atrasos' | 'frequencia';
}

export class SaveFilterDto implements SaveFilterRequest {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Dê um nome ao filtro' })
  @MaxLength(60)
  name: string;

  @ApiProperty({ example: 'mes' })
  @IsIn(['mes', 'mes-passado', '3-meses', '6-meses', 'ano', 'personalizado'])
  period: string;

  @ApiProperty()
  @IsObject()
  criteria: SaveFilterRequest['criteria'];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

/** Edição parcial (renomear, fixar/desafixar…). */
export class UpdateFilterDto extends PartialType(SaveFilterDto) {}
