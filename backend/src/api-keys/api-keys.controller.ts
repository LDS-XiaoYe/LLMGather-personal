import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiKeysService } from './api-keys.service';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedRequestUser) {
    return { data: await this.apiKeysService.listByUser(user.id) };
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() body: { name?: string },
  ) {
    return await this.apiKeysService.create(user.id, body.name || 'Default Key');
  }

  @Delete(':id')
  async revoke(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    await this.apiKeysService.revoke(user.id, id);
    return { success: true };
  }
}
