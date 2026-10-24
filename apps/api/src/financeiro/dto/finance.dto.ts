import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import {
  ChargeKind,
  MAX_PRICE_CENTS,
  PaymentMethod,
  type CreateChargeRequest,
  type RegisterPaymentRequest,
  type UpdateChargeRequest,
} from '@turmei/contracts';
import { EmptyToNull, IsIsoDate } from '../../common/validators/br.validators';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export class ListChargesQueryDto {
  @ApiPropertyOptional({ example: '2026-10' })
  @IsOptional()
  @Matches(MONTH, { message: 'Mês inválido' })
  month?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ enum: ['abertas', 'atrasadas', 'pagas', 'todas'] })
  @IsOptional()
  @IsIn(['abertas', 'atrasadas', 'pagas', 'todas'])
  status?: 'abertas' | 'atrasadas' | 'pagas' | 'todas';
}

export class MonthQueryDto {
  @ApiProperty({ example: '2026-10' })
  @Matches(MONTH, { message: 'Mês inválido' })
  month: string;
}

export class CloseMonthDto {
  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty({ example: '2026-10' })
  @Matches(MONTH, { message: 'Mês inválido' })
  month: string;
}

export class CreateChargeDto implements CreateChargeRequest {
  @ApiProperty()
  @IsUUID('4', { message: 'Escolha o aluno' })
  studentId: string;

  @ApiPropertyOptional({ enum: [ChargeKind.AVULSA, ChargeKind.AJUSTE] })
  @IsOptional()
  @IsIn([ChargeKind.AVULSA, ChargeKind.AJUSTE])
  kind?: ChargeKind;

  @ApiProperty({ example: 'Material didático' })
  @trim()
  @IsString()
  @IsNotEmpty({ message: 'Descreva a cobrança' })
  @MaxLength(160)
  description: string;

  @ApiProperty()
  @IsInt({ message: 'Informe o valor' })
  @Min(1, { message: 'Informe o valor' })
  @Max(MAX_PRICE_CENTS)
  amountCents: number;

  @ApiProperty()
  @IsIsoDate({ message: 'Escolha o vencimento' })
  dueDate: string;
}

export class UpdateChargeDto implements UpdateChargeRequest {
  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE_CENTS)
  amountCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  discountCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIsoDate()
  dueDate?: string;
}

export class RegisterPaymentDto implements RegisterPaymentRequest {
  @ApiProperty()
  @IsInt({ message: 'Informe o valor recebido' })
  @Min(1, { message: 'Informe o valor recebido' })
  @Max(MAX_PRICE_CENTS)
  amountCents: number;

  @ApiProperty()
  @IsIsoDate({ message: 'Data do pagamento inválida' })
  paidAt: string;

  @ApiProperty({ enum: Object.values(PaymentMethod) })
  @IsIn(Object.values(PaymentMethod), { message: 'Escolha a forma de pagamento' })
  method: PaymentMethod;

  @ApiPropertyOptional()
  @trim()
  @EmptyToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string | null;
}
