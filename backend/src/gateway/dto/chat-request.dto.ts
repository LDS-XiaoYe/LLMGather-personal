import {
  ArrayMinSize,
  IsObject,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ChatMessageDto {
  @IsIn(['system', 'user', 'assistant', 'tool'])
  role!: 'system' | 'user' | 'assistant' | 'tool';

  // content: plain string OR array of content parts (vision/multimodal)
  @IsNotEmpty()
  content!: string | any[];

  @IsOptional()
  @IsString()
  name?: string;
}

export class ChatRequestDto {
  @IsString()
  model!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  top_p?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  max_tokens?: number;

  @IsOptional()
  @IsBoolean()
  stream?: boolean;

  @IsOptional()
  @IsString()
  user?: string;

  @IsOptional()
  @IsObject()
  extra_body?: {
    enable_thinking?: boolean;
    agentMode?: boolean;
    [key: string]: unknown;
  };

  @IsOptional()
  @IsArray()
  tools?: any[];

  @IsOptional()
  tool_choice?: any;

  @IsOptional()
  @IsObject()
  stream_options?: {
    include_usage?: boolean;
    [key: string]: unknown;
  };
}
