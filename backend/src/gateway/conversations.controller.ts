import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationSyncDto } from './dto/conversation-sync.dto';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedRequestUser) {
    const data = await this.conversationsService.listByUser(user.id);
    return { data };
  }

  @Put('sync')
  async sync(@CurrentUser() user: AuthenticatedRequestUser, @Body() payload: ConversationSyncDto) {
    try {
      await this.conversationsService.syncByUser(user.id, payload);
      return { ok: true };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[sync] controller error:', err.message, err.stack);
      throw error;
    }
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthenticatedRequestUser, @Param('id') id: string) {
    await this.conversationsService.softDelete(user.id, id);
    return { ok: true };
  }
}
