import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AgentMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(20000)
  content!: string;
}

export class CreateAgentDto {
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
  @MaxLength(128)
  model!: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  systemPrompt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(32000)
  maxTokens?: number;

  @IsOptional()
  @IsBoolean()
  memoryEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  toolIds?: string[];

  @IsOptional()
  @IsObject()
  toolPermissions?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  knowledgeBaseIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  skillIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  workflowIds?: string[];

  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: 'active' | 'archived';
}

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  systemPrompt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(32000)
  maxTokens?: number;

  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: 'active' | 'archived';

  @IsOptional()
  @IsBoolean()
  memoryEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  toolIds?: string[];

  @IsOptional()
  @IsObject()
  toolPermissions?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  knowledgeBaseIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  skillIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  workflowIds?: string[];
}

export class RunAgentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30000)
  input!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AgentMessageDto)
  messages?: AgentMessageDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxSteps?: number;

  @IsOptional()
  @IsIn(['standard', 'reflective', 'fast'])
  mode?: 'standard' | 'reflective' | 'fast';

  @IsOptional()
  @IsIn(['balanced', 'knowledge_first', 'memory_first', 'minimal'])
  contextStrategy?: 'balanced' | 'knowledge_first' | 'memory_first' | 'minimal';

  @IsOptional()
  @IsObject()
  retryPolicy?: {
    maxRetries?: number;
    retryToolFailure?: boolean;
    retryPlannerFailure?: boolean;
  };

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  approvedToolIds?: string[];

}

export class EvaluateAgentRunDto {
  @IsOptional()
  @IsString()
  @MaxLength(12000)
  expectedOutput?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  rubric?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  judgeModel?: string;

  @IsOptional()
  @IsIn(['rules', 'llm', 'hybrid'])
  mode?: 'rules' | 'llm' | 'hybrid';
}

export class RunAgentTestSuiteDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  judgeModel?: string;

  @IsOptional()
  @IsIn(['rules', 'llm', 'hybrid'])
  evaluationMode?: 'rules' | 'llm' | 'hybrid';
}

export class UpdateAgentPublicationDto {
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsBoolean()
  apiEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  publicSlug?: string;
}

export class CreateAgentVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class PublishAgentVersionDto {
  @IsOptional()
  @IsString()
  versionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsIn(['stable', 'canary'])
  releaseMode?: 'stable' | 'canary';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  trafficPercent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsBoolean()
  apiEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  publicSlug?: string;
}

export class GenerateAgentImprovementSuggestionsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  recentRunLimit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  judgeModel?: string;
}

export class CreateAgentTestSuiteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateAgentTestCaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30000)
  input!: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  expectedOutput?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  rubric?: string;
}

export class GenerateAgentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  requirement!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  model!: string;

  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}

export class InstallAgentTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  templateId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  model!: string;
}

export class InstallBuiltinAgentDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  model?: string;
}

export class CreateAgentMarketplaceTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  sourceAgentId!: string;
}
