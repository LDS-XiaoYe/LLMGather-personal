import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateToolDto, InvokeToolDto, TestToolDto, UpdateToolDto } from './dto/tools.dto';
import { ToolsService } from './tools.service';

@Controller('tools')
@UseGuards(JwtAuthGuard)
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedRequestUser) {
    return { data: await this.toolsService.listForUser(user.id) };
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() payload: CreateToolDto,
  ) {
    return { data: await this.toolsService.create(user.id, payload) };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: UpdateToolDto,
  ) {
    return { data: await this.toolsService.update(user.id, id, payload) };
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    await this.toolsService.remove(user.id, id);
    return { ok: true };
  }

  @Post(':id/test')
  async test(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: TestToolDto,
  ) {
    return { data: await this.toolsService.test(user.id, id, payload.args) };
  }

  @Post(':id/invoke')
  async invoke(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: InvokeToolDto,
  ) {
    return {
      data: await this.toolsService.invoke(user.id, id, payload.args, {
        agentId: payload.agentId,
        runId: payload.runId,
      }),
    };
  }
}
