import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { AdminService } from './admin.service';
import { BillingService } from '../billing/billing.service';
import { UsersService } from '../auth/users.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly billingService: BillingService,
    private readonly usersService: UsersService,
  ) {}

  /** GET /v1/admin/stats — dashboard overview */
  @Get('stats')
  async getStats() {
    const stats = await this.adminService.getStats();
    return { data: stats };
  }

  /** GET /v1/admin/stats/daily — daily usage for all users */
  @Get('stats/daily')
  async getDailyStats(@Query('days') days?: string) {
    const d = Math.min(365, Math.max(1, Number(days) || 30));
    return { data: await this.billingService.getDailyUsageAll(d) };
  }

  /** GET /v1/admin/stats/models — model usage breakdown */
  @Get('stats/models')
  async getModelUsageStats() {
    return { data: await this.adminService.getModelUsageStats() };
  }

  /** GET /v1/admin/stats/today — today's aggregated stats */
  @Get('stats/today')
  async getTodayStats() {
    return { data: await this.adminService.getTodayStats() };
  }

  /** GET /v1/admin/check — lightweight check if current user is admin */
  @Get('check')
  async checkAdmin(@CurrentUser() user: AuthenticatedRequestUser) {
    return { isAdmin: user.role === 'admin', role: user.role };
  }

  /** GET /v1/admin/users — list all users */
  @Get('users')
  async listUsers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(200, Math.max(1, Number(pageSize) || 50));
    return this.adminService.listUsers(p, ps, search);
  }

  /** PATCH /v1/admin/users/:id — update user (credits, role) */
  @Patch('users/:id')
  @HttpCode(HttpStatus.OK)
  async updateUser(
    @Param('id') userId: string,
    @Body() body: { credits?: number; role?: string },
  ) {
    if (!body.credits && !body.role) {
      throw new BadRequestException('至少需要提供 credits 或 role 字段');
    }
    if (body.credits !== undefined && (typeof body.credits !== 'number' || body.credits < 0)) {
      throw new BadRequestException('credits 必须为非负数');
    }
    const user = await this.adminService.updateUser(userId, body);
    return { data: user };
  }

  /** DELETE /v1/admin/users/:id — delete user and all related data */
  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('id') userId: string) {
    await this.adminService.deleteUser(userId);
    return { data: { deleted: true } };
  }

  /** PATCH /v1/admin/users/:id/password — admin reset user password */
  @Patch('users/:id/password')
  @HttpCode(HttpStatus.OK)
  async resetUserPassword(
    @Param('id') userId: string,
    @Body() body: { password: string },
  ) {
    if (!body.password || body.password.length < 4) {
      throw new BadRequestException('密码长度至少 4 位');
    }
    await this.adminService.resetUserPassword(userId, body.password);
    return { data: { success: true } };
  }

  /** GET /v1/admin/billing — all billing ledger entries */
  @Get('billing')
  async listBilling(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('username') username?: string,
    @Query('model') model?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(200, Math.max(1, Number(pageSize) || 50));
    return this.adminService.listBillingLedger(p, ps, { username, model, fromDate, toDate });
  }

  /** GET /v1/admin/billing/export — export billing data as CSV */
  @Get('billing/export')
  async exportBillingCsv(
    @Query('username') username: string,
    @Query('model') model: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Res() res: Response,
  ) {
    const csv = await this.adminService.exportBillingCsv({ username, model, fromDate, toDate });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=billing-export.csv');
    res.send(csv);
  }

  /** PATCH /v1/admin/billing/rules/:key — update a billing rule */
  @Patch('billing/rules/:key')
  @HttpCode(HttpStatus.OK)
  async updateBillingRule(
    @Param('key') key: string,
    @Body() body: { value: number; description?: string },
  ) {
    if (typeof body.value !== 'number' || body.value < 0) {
      throw new BadRequestException('value 必须为非负数');
    }
    const rule = await this.adminService.updateBillingRule(key, body.value, body.description);
    return { data: rule };
  }

  /* ──────── Provider API Key management ──────── */

  /** GET /v1/admin/provider-keys — list all provider API keys */
  @Get('provider-keys')
  async listProviderKeys(@Query('provider') provider?: string) {
    const keys = await this.adminService.listProviderApiKeys(provider);
    return { data: keys };
  }

  /** POST /v1/admin/provider-keys — add a new provider API key */
  @Post('provider-keys')
  @HttpCode(HttpStatus.CREATED)
  async addProviderKey(
    @Body() body: { provider: string; name?: string; key: string },
  ) {
    if (!body.provider || !body.key) {
      throw new BadRequestException('provider 和 key 为必填字段');
    }
    const configs = await this.adminService.listProviderConfigs();
    const validProviders = configs.map((c) => c.providerName);
    if (validProviders.length > 0 && !validProviders.includes(body.provider)) {
      throw new BadRequestException(
        `无效的 provider: ${body.provider}，可选值: ${validProviders.join(', ')}`,
      );
    }
    const row = await this.adminService.addProviderApiKey(
      body.provider,
      body.name || 'Default',
      body.key,
    );
    return { data: row };
  }

  /** DELETE /v1/admin/provider-keys/:id — delete a provider API key */
  @Delete('provider-keys/:id')
  @HttpCode(HttpStatus.OK)
  async deleteProviderKey(@Param('id') id: string) {
    const result = await this.adminService.deleteProviderApiKey(id);
    return { data: result };
  }

  /* ──────── Provider Config management ──────── */

  /** GET /v1/admin/provider-configs — list all provider configs */
  @Get('provider-configs')
  async listProviderConfigs() {
    const configs = await this.adminService.listProviderConfigs();
    return { data: configs };
  }

  /** POST /v1/admin/provider-configs — create a new provider config */
  @Post('provider-configs')
  @HttpCode(HttpStatus.CREATED)
  async createProviderConfig(
    @Body()
    body: {
      providerName: string;
      displayName: string;
      baseUrl: string;
      models: string;
      modelPrefix?: string;
      authHeader?: string;
      authPrefix?: string;
      timeoutMs?: number;
      retryCount?: number;
    },
  ) {
    if (!body.providerName || !body.displayName || !body.baseUrl || !body.models) {
      throw new BadRequestException(
        'providerName, displayName, baseUrl, models 为必填字段',
      );
    }
    const config = await this.adminService.createProviderConfig(body);
    return { data: config };
  }

  /** PATCH /v1/admin/provider-configs/:id — update a provider config */
  @Patch('provider-configs/:id')
  @HttpCode(HttpStatus.OK)
  async updateProviderConfig(
    @Param('id') id: string,
    @Body()
    body: {
      providerName?: string;
      displayName?: string;
      baseUrl?: string;
      models?: string;
      modelPrefix?: string;
      authHeader?: string;
      authPrefix?: string;
      timeoutMs?: number;
      retryCount?: number;
      enabled?: boolean;
    },
  ) {
    // Handle toggle separately
    if (body.enabled !== undefined) {
      const config = await this.adminService.toggleProviderEnabled(id, body.enabled);
      return { data: config };
    }
    const config = await this.adminService.updateProviderConfig(id, body);
    return { data: config };
  }

  /** DELETE /v1/admin/provider-configs/:id — delete a provider config */
  @Delete('provider-configs/:id')
  @HttpCode(HttpStatus.OK)
  async deleteProviderConfig(@Param('id') id: string) {
    const result = await this.adminService.deleteProviderConfig(id);
    return { data: result };
  }

  /* ──────── System Settings ──────── */

  /** GET /v1/admin/settings — list all system settings */
  @Get('settings')
  async getSystemSettings() {
    return { data: await this.adminService.getSystemSettings() };
  }

  /** PATCH /v1/admin/settings/:key — update a system setting */
  @Patch('settings/:key')
  @HttpCode(HttpStatus.OK)
  async updateSystemSetting(
    @Param('key') key: string,
    @Body() body: { value: string },
  ) {
    if (body.value === undefined) {
      throw new BadRequestException('value 为必填字段');
    }
    await this.adminService.updateSystemSetting(key, body.value);
    return { data: { key, value: body.value } };
  }

  /** GET /v1/admin/invitation/credits — get invitation credits reward */
  @Get('invitation/credits')
  async getInvitationCredits() {
    const credits = await this.usersService.getInvitationCredits();
    return { data: { credits } };
  }

  /** PATCH /v1/admin/invitation/credits — update invitation credits reward */
  @Patch('invitation/credits')
  @HttpCode(HttpStatus.OK)
  async updateInvitationCredits(@Body() body: { credits: number }) {
    if (typeof body.credits !== 'number' || body.credits < 0) {
      throw new BadRequestException('credits 必须为非负数');
    }
    await this.usersService.setInvitationCredits(body.credits);
    return { data: { credits: body.credits } };
  }

  /* ──────── Model Tier Management ──────── */

  @Get('model-tiers')
  async getModelTiers() {
    return { data: await this.adminService.getModelTiers() };
  }

  @Put('model-tiers')
  @HttpCode(HttpStatus.OK)
  async updateModelTiers(
    @Body() body: { tiers: Record<string, string[]>; prices: Record<string, { prompt: number; completion: number }>; labels?: Record<string, string>; examples?: Record<string, string> },
  ) {
    return { data: await this.adminService.updateModelTiers(body) };
  }

  @Post('model-tiers/:tierKey/models')
  @HttpCode(HttpStatus.OK)
  async addModelsToTier(
    @Param('tierKey') tierKey: string,
    @Body() body: { models: string[] },
  ) {
    return { data: await this.adminService.addModelsToTier(tierKey, body.models) };
  }

  @Delete('model-tiers/:tierKey/models/:modelId')
  @HttpCode(HttpStatus.OK)
  async removeModelFromTier(
    @Param('tierKey') tierKey: string,
    @Param('modelId') modelId: string,
  ) {
    return { data: await this.adminService.removeModelFromTier(tierKey, modelId) };
  }
}
