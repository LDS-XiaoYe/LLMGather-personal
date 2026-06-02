import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMcpServerDto, TestMcpServerDto } from './dto/mcp.dto';
import { McpService } from './mcp.service';

@Controller('mcp')
@UseGuards(JwtAuthGuard)
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Get('servers')
  async list(@CurrentUser() user: AuthenticatedRequestUser) {
    return { data: await this.mcpService.list(user.id) };
  }

  @Post('servers')
  async create(@CurrentUser() user: AuthenticatedRequestUser, @Body() payload: CreateMcpServerDto) {
    return { data: await this.mcpService.create(user.id, payload) };
  }

  @Post('servers/:id/test')
  async test(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() payload: TestMcpServerDto,
  ) {
    return { data: await this.mcpService.test(user.id, id, payload.query || 'test') };
  }
}
