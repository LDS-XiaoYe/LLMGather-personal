import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsISO8601, ValidateIf, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateAdminUserDto {
  @IsString() @MinLength(1) @MaxLength(64) username!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @IsEmail() @MaxLength(191) email!: string;
  @ValidateIf((_object, value) => value !== undefined) @IsIn(['admin', 'user']) role?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsNumber() @Min(0) @Max(999999) credits?: number;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() emailVerified?: boolean;
}
export class UpdateAdminUserDto {
  @ValidateIf((_object, value) => value !== undefined) @IsNumber() @Min(0) @Max(999999) expectedCredits?: number;
  @ValidateIf((_object, value) => value !== undefined) @IsNumber() @Min(0) @Max(999999) credits?: number;
  @ValidateIf((_object, value) => value !== undefined) @IsIn(['admin', 'user']) role?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() emailVerified?: boolean;
}
export class ResetAdminPasswordDto {
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
export class UpdateSettingDto {
  @IsString() @MaxLength(65535) value!: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MaxLength(65535) expectedValue?: string;
}
export class BillingRuleDto {
  @IsNumber() @Min(0) @Max(999999) value!: number;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MaxLength(512) description?: string;
}
export class InvitationCreditsDto {
  @IsNumber() @Min(0) @Max(999999) credits!: number;
}
export class ProviderKeyDto {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,64}$/) provider!: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MaxLength(128) name?: string;
  @IsString() @MinLength(1) @MaxLength(4096) key!: string;
}
export class CreateProviderDto {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,64}$/) providerName!: string;
  @IsString() @MinLength(1) @MaxLength(128) displayName!: string;
  @IsString() @MinLength(1) @MaxLength(2048) baseUrl!: string;
  @IsString() @MinLength(1) @MaxLength(16384) models!: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MaxLength(128) modelPrefix?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @Matches(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/) @MaxLength(128) authHeader?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @Matches(/^[^\r\n]*$/) @MaxLength(128) authPrefix?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsInt() @Min(100) @Max(300000) timeoutMs?: number;
  @ValidateIf((_object, value) => value !== undefined) @IsInt() @Min(0) @Max(5) retryCount?: number;
}
export class UpdateProviderDto {
  @ValidateIf((_object, value) => value !== undefined) @IsISO8601() expectedUpdatedAt?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @Matches(/^[a-zA-Z0-9_-]{1,64}$/) providerName?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MinLength(1) @MaxLength(128) displayName?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MinLength(1) @MaxLength(2048) baseUrl?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MinLength(1) @MaxLength(16384) models?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MaxLength(128) modelPrefix?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @Matches(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/) @MaxLength(128) authHeader?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @Matches(/^[^\r\n]*$/) @MaxLength(128) authPrefix?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsInt() @Min(100) @Max(300000) timeoutMs?: number;
  @ValidateIf((_object, value) => value !== undefined) @IsInt() @Min(0) @Max(5) retryCount?: number;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() enabled?: boolean;
}
export class TierModelsDto {
  @IsArray() @ArrayMaxSize(1024) @IsString({ each: true }) @MinLength(1, { each: true }) @MaxLength(256, { each: true }) models!: string[];
}
export class DeleteRouterRuleDto {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,64}$/) intent!: string;
}
export class RouterRuleDto extends DeleteRouterRuleDto {
  @IsArray() @ArrayMaxSize(1024) @IsString({ each: true }) @MinLength(1, { each: true }) @MaxLength(256, { each: true }) models!: string[];
}
