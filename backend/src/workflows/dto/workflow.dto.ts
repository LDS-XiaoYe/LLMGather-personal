import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class WorkflowNodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['prompt', 'agent', 'tool', 'knowledge', 'memory', 'skill'])
  @MaxLength(32)
  type!: 'prompt' | 'agent' | 'tool' | 'knowledge' | 'memory' | 'skill';

  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsObject()
  config!: Record<string, unknown>;
}

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => WorkflowNodeDto)
  nodes!: WorkflowNodeDto[];
}

export class RunWorkflowDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30000)
  input!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  agentId?: string;
}
