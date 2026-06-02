import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemSettingsService } from './system-settings.service';
import { SETTINGS_THROTTLE_KEY } from './settings-throttle.decorator';

interface BucketEntry { ts: number }

@Injectable()
export class SettingsThrottleGuard implements CanActivate {
  // map of key -> identifier -> timestamps array
  private store = new Map<string, Map<string, number[]>>();

  constructor(private readonly reflector: Reflector, private readonly settings: SystemSettingsService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const key = this.reflector.get<string>(SETTINGS_THROTTLE_KEY, context.getHandler());
    if (!key) return true; // not configured — allow

    const req = context.switchToHttp().getRequest();
    const identifier = (req.user && req.user.id) ? `user:${req.user.id}` : `ip:${req.ip || req.connection?.remoteAddress || 'anon'}`;

    const limit = Number(this.settings.getNumber(key, NaN)) || Number(this.settings.getNumber('rate_limit_relay', 60));
    const ttlSeconds = Number(this.settings.getNumber('rate_limit_ttl_seconds', 60));
    const ttlMs = Math.max(1, ttlSeconds) * 1000;

    let keyMap = this.store.get(key);
    if (!keyMap) {
      keyMap = new Map<string, number[]>();
      this.store.set(key, keyMap);
    }

    const now = Date.now();
    let arr = keyMap.get(identifier);
    if (!arr) {
      arr = [];
      keyMap.set(identifier, arr);
    }

    // drop expired timestamps
    while (arr.length > 0 && arr[0] <= now - ttlMs) arr.shift();

    if (arr.length >= limit) {
      return false;
    }

    arr.push(now);
    return true;
  }
}
