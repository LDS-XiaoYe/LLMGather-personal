import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AlipayService } from './alipay.service';
import { OrderResponse } from './dto';

@Injectable()
export class RechargeService {
  private readonly logger = new Logger(RechargeService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly alipayService: AlipayService,
  ) {}

  async createOrder(userId: string, amount: number): Promise<OrderResponse> {
    if (!Number.isInteger(amount) || amount < 1 || amount > 5000) {
      throw new BadRequestException('充值金额需为 1-5000 的整数');
    }

    const db = this.databaseService.connection;
    const id = randomUUID();
    const now = this.databaseService.now();
    const subject = `LLMGather 充值 ${amount} 元`;

    let qrCode: string | null = null;
    let alipayTradeNo: string | null = null;

    try {
      qrCode = await this.alipayService.precreate(id, amount, subject);
    } catch (e) {
      this.logger.error(`Alipay precreate failed for order ${id}`, e);
      throw new BadRequestException('支付宝预下单失败，请稍后重试');
    }

    await db.prepare(
      `INSERT INTO recharge_orders (id, user_id, amount, status, alipay_trade_no, qr_code, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
    ).run(id, userId, amount, alipayTradeNo, qrCode, now);

    return {
      id,
      amount,
      status: 'pending',
      qrCode,
      alipayTradeNo,
      createdAt: now,
      paidAt: null,
    };
  }

  async handleNotify(params: Record<string, string>): Promise<string> {
    // 1. Verify signature
    if (!this.alipayService.verifySignature(params)) {
      this.logger.error('Alipay notify signature verification failed');
      return 'fail';
    }

    const outTradeNo = params.out_trade_no;
    const tradeNo = params.trade_no;
    const tradeStatus = params.trade_status;
    const totalAmount = parseFloat(params.total_amount || '0');

    if (!outTradeNo) {
      this.logger.error('Alipay notify missing out_trade_no');
      return 'fail';
    }

    const db = this.databaseService.connection;

    // 2. Query order
    const order = await db.prepare(
      'SELECT id, user_id, amount, status FROM recharge_orders WHERE id = ?',
    ).get(outTradeNo) as { id: string; user_id: string; amount: number; status: string } | undefined;

    if (!order) {
      this.logger.error(`Recharge order not found: ${outTradeNo}`);
      return 'fail';
    }

    if (order.status === 'paid') {
      // Already processed — idempotent
      return 'success';
    }

    // 3. Verify amount matches (within 0.10 tolerance)
    if (Math.abs(order.amount - totalAmount) > 0.10) {
      this.logger.error(`Amount mismatch: order ${order.amount} vs paid ${totalAmount}`);
      return 'fail';
    }

    // 4. Check trade status
    if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
      await db.prepare(
        'UPDATE recharge_orders SET status = ?, alipay_trade_no = ? WHERE id = ?',
      ).run('pending', tradeNo, order.id);
      return 'success';
    }

    // 5. Update order & user credits (1:1 RMB to credits)
    const now = this.databaseService.now();
    await db.prepare(
      'UPDATE recharge_orders SET status = ?, alipay_trade_no = ?, paid_at = ? WHERE id = ?',
    ).run('paid', tradeNo, now, order.id);

    const newCredits = Number((order.amount).toFixed(6));
    const user = await db.prepare(
      'SELECT credits FROM users WHERE id = ?',
    ).get(order.user_id) as { credits: number } | undefined;

    if (!user) {
      this.logger.error(`User not found: ${order.user_id}`);
      return 'fail';
    }

    const updatedCredits = Number((Number(user.credits) + newCredits).toFixed(6));
    await db.prepare(
      'UPDATE users SET credits = ? WHERE id = ?',
    ).run(updatedCredits, order.user_id);

    this.logger.log(`Recharge order ${order.id} paid: ${order.amount} CNY -> credits for user ${order.user_id}`);
    return 'success';
  }

  async checkPayment(orderId: string, userId: string): Promise<OrderResponse> {
    const db = this.databaseService.connection;

    const order = await db.prepare(
      'SELECT id, user_id, amount, status FROM recharge_orders WHERE id = ?',
    ).get(orderId) as { id: string; user_id: string; amount: number; status: string } | undefined;

    if (!order || order.user_id !== userId) {
      throw new NotFoundException('订单不存在');
    }

    if (order.status === 'paid') {
      return this.getOrder(orderId, userId);
    }

    const result = await this.alipayService.queryOrder(orderId);
    if (!result) {
      throw new BadRequestException('查询支付状态失败，请稍后重试');
    }

    if (result.status === 'TRADE_SUCCESS' || result.status === 'TRADE_FINISHED') {
      const now = this.databaseService.now();
      await db.prepare(
        'UPDATE recharge_orders SET status = ?, alipay_trade_no = ?, paid_at = ? WHERE id = ?',
      ).run('paid', result.tradeNo, now, order.id);

      const user = await db.prepare(
        'SELECT credits FROM users WHERE id = ?',
      ).get(order.user_id) as { credits: number } | undefined;

      if (user) {
        const newCredits = Number((Number(user.credits) + Number(order.amount)).toFixed(6));
        await db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(newCredits, order.user_id);

        this.logger.log(`Recharge order ${order.id} confirmed paid via query: ${order.amount} CNY`);
      }
    }

    return this.getOrder(orderId, userId);
  }

  async getOrder(orderId: string, userId: string): Promise<OrderResponse> {
    const db = this.databaseService.connection;
    const row = await db.prepare(
      `SELECT id, user_id as userId, amount, status, alipay_trade_no as alipayTradeNo,
              qr_code as qrCode, created_at as createdAt, paid_at as paidAt
       FROM recharge_orders WHERE id = ?`,
    ).get(orderId) as Record<string, unknown> | undefined;

    if (!row || (row.userId as string) !== userId) {
      throw new NotFoundException('订单不存在');
    }

    return {
      id: row.id as string,
      amount: Number(row.amount),
      status: row.status as string,
      qrCode: (row.qrCode as string) || null,
      alipayTradeNo: (row.alipayTradeNo as string) || null,
      createdAt: row.createdAt as string,
      paidAt: (row.paidAt as string) || null,
    };
  }

  async listOrders(userId: string, page = 1, pageSize = 20): Promise<{ data: OrderResponse[]; total: number }> {
    const db = this.databaseService.connection;
    const offset = (page - 1) * pageSize;

    const { count } = await db.prepare(
      'SELECT COUNT(*) as count FROM recharge_orders WHERE user_id = ?',
    ).get(userId) as { count: number };

    const rows = await db.prepare(
      `SELECT id, amount, status, alipay_trade_no as alipayTradeNo,
              qr_code as qrCode, created_at as createdAt, paid_at as paidAt
       FROM recharge_orders WHERE user_id = ? AND status != 'pending'
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ).all(userId, pageSize, offset) as Array<Record<string, unknown>>;

    return {
      data: rows.map((row) => ({
        id: row.id as string,
        amount: Number(row.amount),
        status: row.status as string,
        qrCode: (row.qrCode as string) || null,
        alipayTradeNo: (row.alipayTradeNo as string) || null,
        createdAt: row.createdAt as string,
        paidAt: (row.paidAt as string) || null,
      })),
      total: Number(count),
    };
  }
}
