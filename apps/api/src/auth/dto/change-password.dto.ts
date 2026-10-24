import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MIN_LENGTH, type ChangePasswordRequest } from '@turmei/contracts';

export class ChangePasswordDto implements ChangePasswordRequest {
  @ApiProperty({ required: false, description: 'Não precisa para quem ainda não tem senha (login social)' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `A nova senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
  })
  @MaxLength(128)
  newPassword: string;
}
