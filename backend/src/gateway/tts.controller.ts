import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProviderApiKeyStore } from '../providers/provider-api-key.store';
import { SystemSettingsService } from '../common/system-settings.service';

@Controller('tts')
@UseGuards(JwtAuthGuard)
export class TtsController {
  constructor(
    private readonly apiKeyStore: ProviderApiKeyStore,
    private readonly settings: SystemSettingsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async synthesize(
    @Body()
    body: {
      model?: string;
      messages: Array<{ role: string; content: string }>;
      audio?: { format?: string; voice?: string };
    },
  ) {
    if (!body.messages || body.messages.length === 0) {
      throw new BadRequestException('messages 不能为空');
    }

    // Get xiaomi-mimo API key from the store
    let apiKey: string;
    try {
      const pool = this.apiKeyStore.getPool('xiaomi-mimo');
      apiKey = pool.getKey();
    } catch {
      throw new BadRequestException(
        '未配置 Xiaomi MiMo API Key，请在管理后台添加',
      );
    }

    const model = body.model || 'mimo-v2.5-tts';
    const format = body.audio?.format || this.settings.getString('tts_default_format', 'wav');
    const voice = body.audio?.voice || this.settings.getString('tts_default_voice', '冰糖');

    // Get base URL from provider config
    const configs = await this.apiKeyStore.listConfigs();
    const xiaomiConfig = configs.find((c) => c.providerName === 'xiaomi-mimo');
    const baseUrl = xiaomiConfig?.baseUrl || 'https://api.xiaomimimo.com/v1';

    // Forward to Xiaomi TTS API
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        model,
        messages: body.messages,
        audio: { format, voice },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new BadRequestException(
        `TTS 请求失败 (${response.status}): ${errText}`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: { audio?: { data?: string } };
      }>;
    };

    const audioData = data.choices?.[0]?.message?.audio?.data;
    if (!audioData) {
      throw new BadRequestException('TTS 响应中没有音频数据');
    }

    return { audio: audioData };
  }
}
