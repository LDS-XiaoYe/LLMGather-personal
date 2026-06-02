import { ArrayMaxSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AgentTeamMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  agentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  inputTemplate?: string;
}

export class CreateAgentTeamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(['sequential', 'review', 'debate', 'parallel', 'consensus', 'router'])
  strategy?: 'sequential' | 'review' | 'debate' | 'parallel' | 'consensus' | 'router';

  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => AgentTeamMemberDto)
  members!: AgentTeamMemberDto[];
}

export class RunAgentTeamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30000)
  input!: string;
}
