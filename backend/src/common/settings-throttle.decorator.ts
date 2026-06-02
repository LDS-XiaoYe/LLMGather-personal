import { SetMetadata } from '@nestjs/common';

export const SETTINGS_THROTTLE_KEY = 'settingsThrottleKey';

export const SettingsThrottle = (key: string) => SetMetadata(SETTINGS_THROTTLE_KEY, key);
