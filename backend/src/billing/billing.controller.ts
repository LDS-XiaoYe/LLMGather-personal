import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingService } from './billing.service';
import { DatabaseService } from '../database/database.service';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get('rules')
  async rules() {
    return { data: await this.billingService.getRules() };
  }

  @Get('ledger')
  async ledger(@CurrentUser() user: AuthenticatedRequestUser) {
    return { data: await this.billingService.getLedger(user.id) };
  }

  @Get('usage/daily')
  async dailyUsage(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query('days') days?: string,
  ) {
    const d = Math.min(365, Math.max(1, Number(days) || 30));
    return { data: await this.billingService.getDailyUsage(user.id, d) };
  }

  @Get('page-models')
  async pageModels() {
    const db = this.databaseService.connection;
    const rows = await db.prepare(
      'SELECT `key`, value FROM system_settings WHERE `key` LIKE ? OR `key` IN (?, ?, ?)',
    ).all('page_models_%', 'model_tier_mapping', 'tier_labels', 'model_tags') as Array<{ key: string; value: string }>;
    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.key] = r.value;
    }
    return { data: result };
  }
}
