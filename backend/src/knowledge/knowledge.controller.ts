import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddKnowledgeDocumentDto, CreateKnowledgeBaseDto, ParseFileDto, SearchKnowledgeDto } from './dto/knowledge.dto';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('bases')
  async list(@CurrentUser() user: AuthenticatedRequestUser) {
    return { data: await this.knowledgeService.list(user.id) };
  }

  @Post('bases')
  async create(@CurrentUser() user: AuthenticatedRequestUser, @Body() payload: CreateKnowledgeBaseDto) {
    return { data: await this.knowledgeService.create(user.id, payload) };
  }

  @Get('bases/:id/documents')
  async listDocuments(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return { data: await this.knowledgeService.listDocuments(user.id, id) };
  }

  @Post('bases/:id/documents')
  async addDocument(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: AddKnowledgeDocumentDto,
  ) {
    return { data: await this.knowledgeService.addDocument(user.id, id, payload) };
  }

  @Delete('documents/:id')
  async deleteDocument(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return { data: await this.knowledgeService.deleteDocument(user.id, id) };
  }

  @Post('parse-file')
  async parseFile(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() payload: ParseFileDto,
  ) {
    return { data: await this.knowledgeService.parseFile(payload.file, payload.filename) };
  }

  @Post('bases/:id/search')
  async search(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: SearchKnowledgeDto,
  ) {
    return { data: await this.knowledgeService.search(user.id, [id], payload.query, payload.limit ?? 5, { mode: payload.mode }) };
  }
}
