import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, Validate, ValidateNested, ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';
import { isAllowedPushEndpoint } from '../push-endpoint';
import type { PushSubscriptionRequest } from '@turmei/contracts';

class KeysDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  p256dh: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  auth: string;
}

@ValidatorConstraint({ name: 'pushEndpoint' })
class PushEndpointConstraint implements ValidatorConstraintInterface {
  validate(v: unknown) {
    return typeof v === 'string' && isAllowedPushEndpoint(v);
  }
  defaultMessage() {
    return 'Endereço de notificação inválido';
  }
}

export class SubscribeDto implements PushSubscriptionRequest {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  @Validate(PushEndpointConstraint)
  endpoint: string;

  @ApiProperty({ type: KeysDto })
  @ValidateNested()
  @Type(() => KeysDto)
  keys: KeysDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceLabel?: string;
}

export class UnsubscribeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  endpoint: string;
}
