import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class WorkflowNodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  type!: 'prompt' | 'agent' | 'tool' | 'knowledge' | 'memory';

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
}
