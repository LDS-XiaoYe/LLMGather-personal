import { IsBoolean, IsEmail, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { BehaviorPayload } from '../security/security.types';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  username!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  verificationCode!: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  invitationCode?: string;

  @IsOptional()
  @IsString()
  challengeId?: string;

  @IsOptional()
  @IsObject()
  behaviorPayload?: BehaviorPayload;

  @IsOptional()
  @IsString()
  captchaId?: string;

  @IsOptional()
  @IsString()
  captchaCode?: string;

  @IsBoolean()
  tosAccepted!: boolean;
}

export class LoginDto {
  @IsString()
  @MaxLength(64)
  username!: string;

  @IsString()
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  challengeId?: string;

  @IsOptional()
  @IsObject()
  behaviorPayload?: BehaviorPayload;

  @IsOptional()
  @IsString()
  captchaId?: string;

  @IsOptional()
  @IsString()
  captchaCode?: string;
}

export class TopUpDto {
  @IsNumber()
  @Min(1)
  amount!: number;
}

export class SendVerificationCodeDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;
}
