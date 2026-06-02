import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InvokeToolDto } from './dto/tools.dto';
import { ToolsService } from './tools.service';

@Controller('tools')
@UseGuards(JwtAuthGuard)
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedRequestUser) {
    return { data: await this.toolsService.listForUser(user.id) };
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
