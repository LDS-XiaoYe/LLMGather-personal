import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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
}

export class SearchKnowledgeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  query!: string;
}
