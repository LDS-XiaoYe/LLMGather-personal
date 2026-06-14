import { IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const MEMORY_TYPE_VALUES = ['messages', 'summary', 'preference', 'fact', 'project', 'skill', 'episode', 'procedure'] as const;

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
  @IsIn(MEMORY_TYPE_VALUES)
  memoryType?: typeof MEMORY_TYPE_VALUES[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(12000)
  content!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  importance?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
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

  @IsOptional()
  @IsIn(MEMORY_TYPE_VALUES)
  memoryType?: typeof MEMORY_TYPE_VALUES[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class UpdateMemoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  namespace?: string;

  @IsOptional()
  @IsIn(MEMORY_TYPE_VALUES)
  memoryType?: typeof MEMORY_TYPE_VALUES[number];

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

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
