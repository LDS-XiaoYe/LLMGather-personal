import { IsBoolean, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMcpServerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsIn(['notion'])
  serverType!: 'notion';

  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class TestMcpServerDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  query?: string;
}
