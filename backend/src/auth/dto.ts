import { IsEmail, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

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
}

export class LoginDto {
  @IsString()
  @MaxLength(64)
  username!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
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
