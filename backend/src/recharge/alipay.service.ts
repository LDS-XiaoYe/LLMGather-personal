import { Injectable, Logger } from '@nestjs/common';
import { execSync } from 'child_process';
import AlipaySdk from 'alipay-sdk';

function normalizePrivateKey(raw: string): string {
  let key = raw.replace(/\\n/g, '\n').trim();
  if (!key.startsWith('-----BEGIN')) {
    key = `-----BEGIN RSA PRIVATE KEY-----\n${key}\n-----END RSA PRIVATE KEY-----`;
  }
  if (!key.endsWith('\n')) key += '\n';

  if (key.includes('RSA PRIVATE KEY')) {
    try {
      return execSync('openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt', {
        input: key,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim() + '\n';
    } catch {
      return key;
    }
  }
  return key;
}

@Injectable()
export class AlipayService {
  private readonly logger = new Logger(AlipayService.name);
  private sdk: AlipaySdk | null = null;

  private getSdk(): AlipaySdk {
    if (this.sdk) return this.sdk;

    const appId = process.env.ALIPAY_APP_ID || '';
    if (!appId) {
      throw new Error('支付宝未配置（ALIPAY_APP_ID 为空），请在 .env 中配置后重启');
    }

    const rawKey = process.env.ALIPAY_PRIVATE_KEY || '';
    const normalized = normalizePrivateKey(rawKey);
    this.logger.log(`Private key: raw ${rawKey.length} chars (starts ${rawKey.substring(0, 30)}...), normalized ${normalized.length} chars, starts: ${normalized.substring(0, 40)}`);

    this.sdk = new AlipaySdk({
      appId,
      privateKey: normalized,
      keyType: 'PKCS8',
      alipayPublicKey: (process.env.ALIPAY_PUBLIC_KEY || '').replace(/\\n/g, '\n'),
      gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
      signType: (process.env.ALIPAY_SIGN_TYPE || 'RSA2') as 'RSA2' | 'RSA',
      timeout: 30000,
    });

    return this.sdk;
  }

  async precreate(outTradeNo: string, amount: number, subject: string): Promise<string> {
    const sdk = this.getSdk();

    const bizContent: Record<string, unknown> = {
      outTradeNo,
      totalAmount: amount.toFixed(2),
      subject,
      timeoutExpress: '15m',
    };

    const notifyUrl = process.env.ALIPAY_NOTIFY_URL || '';
    if (notifyUrl) {
      bizContent.notifyUrl = notifyUrl;
    }

    const result = await sdk.exec('alipay.trade.precreate', {
      bizContent,
    });
    const qrCode = result?.qrCode || result?.qr_code || '';

    if (!qrCode) {
      this.logger.error('Alipay precreate failed', result);
      throw new Error('支付宝预下单失败，未返回二维码');
    }

    return qrCode;
  }

  verifySignature(params: Record<string, string>): boolean {
    try {
      const sdk = this.getSdk();
      return sdk.checkNotifySign(params);
    } catch (e) {
      this.logger.error('Alipay signature verification error', e);
      return false;
    }
  }

  async queryOrder(outTradeNo: string): Promise<{
    tradeNo: string;
    status: string;
    totalAmount: string;
    buyerLogonId?: string;
  } | null> {
    const sdk = this.getSdk();

    const result = await sdk.exec('alipay.trade.query', {
      bizContent: { outTradeNo },
    });

    if (result?.code !== '10000') {
      return null;
    }

    return {
      tradeNo: result.tradeNo || result.trade_no || '',
      status: result.tradeStatus || result.trade_status || '',
      totalAmount: result.totalAmount || result.total_amount || '',
      buyerLogonId: result.buyerLogonId || result.buyer_logon_id,
    };
  }
}
