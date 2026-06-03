import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSkillDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(12000)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string;

  @IsOptional()
  @IsObject()
  inputSchema?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  outputSchema?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  exampleInput?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  exampleOutput?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  riskLevel?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateSkillDto extends CreateSkillDto {}

export class TestSkillDto {
  @IsString()
  @MaxLength(30000)
  input!: string;
}

export class BindAgentSkillDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  agentId!: string;
}

export class SetAgentSkillsDto {
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  skillIds!: string[];
}
