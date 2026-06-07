import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateToolDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(128)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @IsOptional()
  @IsIn(['javascript', 'typescript', 'python'])
  runtime?: 'javascript' | 'typescript' | 'python';

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  riskLevel?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsObject()
  inputSchema?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  outputSchema?: Record<string, unknown>;

  @IsString()
  @MaxLength(10000)
  code!: string;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(300)
  timeout?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(3)
  retries?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateToolDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @IsOptional()
  @IsIn(['javascript', 'typescript', 'python'])
  runtime?: 'javascript' | 'typescript' | 'python';

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  riskLevel?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsObject()
  inputSchema?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  outputSchema?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  code?: string;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(300)
  timeout?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(3)
  retries?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class InvokeToolDto {
  @IsObject()
  args!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  agentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  runId?: string;
}

export class TestToolDto {
  @IsObject()
  args!: Record<string, unknown>;
}
