import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ConversationMessageDto {
  @IsString()
  id!: string;

  @IsString()
  role!: 'user' | 'assistant';

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  reasoning?: string;

  @IsOptional()
  @IsString()
  model?: string;
}

export class ConversationSessionDto {
  @IsString()
  id!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  chatType?: 'direct' | 'battle' | 'group';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationMessageDto)
  messages!: ConversationMessageDto[];

  @IsNumber()
  updatedAt!: number;
}

export class ConversationSyncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationSessionDto)
  sessions!: ConversationSessionDto[];
}
