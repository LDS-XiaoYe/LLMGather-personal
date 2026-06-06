import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateMemoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(36)
  agentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  namespace?: string;

  @IsOptional()
  @IsIn(['fact', 'preference', 'procedure', 'episode'])
  memoryType?: 'fact' | 'preference' | 'procedure' | 'episode';

  @IsString()
  @IsNotEmpty()
  @MaxLength(12000)
  content!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  importance?: number;
}

export class SearchMemoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  query!: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  agentId?: string;
}

export class UpdateMemoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  namespace?: string;

  @IsOptional()
  @IsIn(['fact', 'preference', 'procedure', 'episode'])
  memoryType?: 'fact' | 'preference' | 'procedure' | 'episode';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(12000)
  content?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  importance?: number;
}
