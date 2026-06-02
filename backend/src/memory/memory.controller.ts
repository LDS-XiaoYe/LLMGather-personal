import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMemoryDto, SearchMemoryDto } from './dto/memory.dto';
import { MemoryService } from './memory.service';

@Controller('memory')
@UseGuards(JwtAuthGuard)
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query('agentId') agentId?: string,
  ) {
    return { data: await this.memoryService.list(user.id, agentId) };
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedRequestUser, @Body() payload: CreateMemoryDto) {
    return { data: await this.memoryService.create(user.id, payload) };
  }

  @Post('search')
  async search(@CurrentUser() user: AuthenticatedRequestUser, @Body() payload: SearchMemoryDto) {
    return { data: await this.memoryService.search(user.id, payload.query, payload.agentId) };
  }
}
