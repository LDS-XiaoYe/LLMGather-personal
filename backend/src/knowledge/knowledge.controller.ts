import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddKnowledgeDocumentDto, CreateKnowledgeBaseDto, CreateUserLibraryFileDto, ParseFileDto, RenameUserLibraryFileDto, SearchKnowledgeDto } from './dto/knowledge.dto';
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
    @Query('query') query?: string,
  ) {
    return { data: await this.knowledgeService.listDocuments(user.id, id, query ?? '') };
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

  @Get('documents/:id/detail')
  async getDocumentDetail(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return { data: await this.knowledgeService.getDocumentDetail(user.id, id) };
  }

  @Get('documents/:id/chunks')
  async listDocumentChunks(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return { data: await this.knowledgeService.listDocumentChunks(user.id, id) };
  }

  @Post('documents/:id/reparse')
  async reparseDocument(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return { data: await this.knowledgeService.reparseDocument(user.id, id) };
  }

  @Get('library/files')
  async listLibraryFiles(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query('query') query?: string,
    @Query('fileType') fileType?: string,
    @Query('source') source?: string,
    @Query('kbStatus') kbStatus?: string,
  ) {
    return { data: await this.knowledgeService.listUserLibraryFiles(user.id, { query, fileType, source, kbStatus }) };
  }

  @Post('library/files')
  async createLibraryFile(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() payload: CreateUserLibraryFileDto,
  ) {
    return { data: await this.knowledgeService.createUserLibraryFile(user.id, payload) };
  }

  @Get('library/files/:id')
  async getLibraryFile(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return { data: await this.knowledgeService.getUserLibraryFile(user.id, id, true) };
  }

  @Patch('library/files/:id')
  async renameLibraryFile(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: RenameUserLibraryFileDto,
  ) {
    return { data: await this.knowledgeService.renameUserLibraryFile(user.id, id, payload.filename) };
  }

  @Delete('library/files/:id')
  async deleteLibraryFile(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return { data: await this.knowledgeService.deleteUserLibraryFile(user.id, id) };
  }

  @Post('library/files/:id/add-to-knowledge/:kbId')
  async addLibraryFileToKnowledge(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Param('kbId') kbId: string,
  ) {
    return { data: await this.knowledgeService.addUserLibraryFileToKnowledge(user.id, id, kbId) };
  }

  @Post('parse-file')
  async parseFile(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() payload: ParseFileDto,
  ) {
    const file = payload.file ?? payload.fileBase64;
    if (!file) throw new BadRequestException('file 或 fileBase64 为必填字段');
    return { data: await this.knowledgeService.parseFile(file, payload.filename) };
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
