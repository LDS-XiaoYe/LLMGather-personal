import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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
