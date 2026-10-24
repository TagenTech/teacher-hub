import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { BillingPlanType, type BillingPlanInput, type CreateBillingPlanRequest } from '@turmei/contracts';
import { EmptyToNull, IsIsoDate } from '../../common/validators/br.validators';

/** Formato bruto; as regras por tipo ficam em `normalizePlanInput` (contracts). */
export class BillingPlanInputDto implements BillingPlanInput {
  @ApiProperty({ enum: Object.values(BillingPlanType) })
  @IsIn(Object.values(BillingPlanType), { message: 'Tipo de plano inválido' })
  type: BillingPlanType;

  @ApiPropertyOptional({ description: 'Centavos' })
  @IsOptional()
  @IsInt()
  monthlyFeeCents?: number | null;

  @ApiPropertyOptional({ description: 'Centavos' })
  @IsOptional()
  @IsInt()
  lessonPriceCents?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  packageLessons?: number | null;

  @ApiPropertyOptional({ description: 'Centavos' })
  @IsOptional()
  @IsInt()
  packagePriceCents?: number | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 28 })
  @IsOptional()
  @IsInt()
  dueDay?: number | null;

  @ApiPropertyOptional()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string | null;
}

export class CreateBillingPlanDto extends BillingPlanInputDto implements CreateBillingPlanRequest {
  @ApiProperty({ example: '2026-11-01' })
  @IsIsoDate()
  validFrom: string;
}
