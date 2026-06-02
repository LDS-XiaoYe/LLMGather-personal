import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RechargeService } from './recharge.service';
import { CreateOrderDto } from './dto';

@Controller('recharge')
export class RechargeController {
  constructor(private readonly rechargeService: RechargeService) {}

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateOrderDto,
  ) {
    const order = await this.rechargeService.createOrder(user.id, dto.amount);
    return { data: order };
  }

  @Post('notify')
  @HttpCode(HttpStatus.OK)
  async notify(@Req() req: Request) {
    const params = req.body as Record<string, string>;
    const result = await this.rechargeService.handleNotify(params);
    if (result === 'fail') {
      return 'fail';
    }
    return 'success';
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  async getOrder(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') orderId: string,
  ) {
    const order = await this.rechargeService.getOrder(orderId, user.id);
    return { data: order };
  }

  @Post('orders/:id/check')
  @UseGuards(JwtAuthGuard)
  async checkPayment(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') orderId: string,
  ) {
    const order = await this.rechargeService.checkPayment(orderId, user.id);
    return { data: order };
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  async listOrders(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(50, Math.max(1, Number(pageSize) || 20));
    return this.rechargeService.listOrders(user.id, p, ps);
  }
}
