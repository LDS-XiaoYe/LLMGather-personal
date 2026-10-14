import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsString, Matches, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const BAILIAN_REGIONS = ['cn-beijing', 'ap-southeast-1', 'cn-hongkong', 'ap-northeast-1', 'eu-central-1', 'us-east-1'] as const;
export class BailianCredentialScopeDto {
  @IsIn(BAILIAN_REGIONS) region!: typeof BAILIAN_REGIONS[number];
  @ValidateIf((_o, v) => v !== undefined) @IsString() @MaxLength(128) @Matches(/^[a-zA-Z0-9-]*$/) workspaceId?: string;
}
export class PreviewBailianModelsDto extends BailianCredentialScopeDto {
  @ValidateIf((_o, v) => v !== undefined) @IsString() @MaxLength(512) @Matches(/^\S*$/) apiKey?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() rememberKey?: boolean;
  @IsBoolean() saveKey!: boolean;
  @IsBoolean() removeMissing!: boolean;
}
export class ApplyBailianModelsDto {
  @IsString() @Matches(/^[a-f0-9-]{36}$/) previewId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10000) @ValidateNested({ each: true }) @Type(() => BailianModelSelectionDto)
  selections!: BailianModelSelectionDto[];
}
export class BailianModelSelectionDto {
  @IsString() @MinLength(1) @MaxLength(128) providerId!: string;
  @IsString() @MinLength(1) @MaxLength(256) modelId!: string;
  @IsIn(['added', 'removed']) action!: 'added' | 'removed';
}
