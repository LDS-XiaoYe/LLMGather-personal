import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateKnowledgeBaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class AddKnowledgeDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200000)
  content!: string;

  @IsOptional()
  @IsString()
  sourceFileId?: string;

  @IsOptional()
  @IsString()
  fileType?: string;
}

export class ParseFileDto {
  @IsOptional()
  @IsString()
  file?: string;

  @IsOptional()
  @IsString()
  fileBase64?: string;

  @IsString()
  @IsNotEmpty()
  filename!: string;
}

export class SearchKnowledgeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  query!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number;

  @IsOptional()
  @IsIn(['hybrid', 'keyword', 'vector'])
  mode?: 'hybrid' | 'keyword' | 'vector';
}

export class CreateUserLibraryFileDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @IsString()
  @IsNotEmpty()
  fileBase64!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsIn(['user_upload', 'agent_generated', 'conversation_attachment', 'intermediate'])
  source?: 'user_upload' | 'agent_generated' | 'conversation_attachment' | 'intermediate';
}

export class RenameUserLibraryFileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  filename!: string;
}
