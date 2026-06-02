import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

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
