import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddKnowledgeDocumentDto, CreateKnowledgeBaseDto, SearchKnowledgeDto } from './dto/knowledge.dto';
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

  @Post('bases/:id/documents')
  async addDocument(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: AddKnowledgeDocumentDto,
  ) {
    return { data: await this.knowledgeService.addDocument(user.id, id, payload) };
  }

  @Post('bases/:id/search')
  async search(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: SearchKnowledgeDto,
  ) {
    return { data: await this.knowledgeService.search(user.id, [id], payload.query) };
  }
}
