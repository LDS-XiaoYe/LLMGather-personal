import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiKeyOrJwtGuard } from '../api-keys/api-key-or-jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CollabMode, CollabService } from './collab.service';

@Controller('collab')
@UseGuards(ApiKeyOrJwtGuard)
export class CollabController {
  constructor(private readonly collabService: CollabService) {}

  @Post('chat/completions')
  async completions(
    @Body() body: { messages: Array<{ role: string; content: string }>; mode?: CollabMode; models?: string[] },
    @Res() res: Response,
  ) {
    const query = [...body.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const mode = body.mode || 'debate';
    const models = body.models?.length ? body.models : this.collabService.pickModels(mode === 'debate' ? 3 : 2);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('x-collab-mode', mode);
    res.setHeader('x-collab-models', models.join(','));

    const abortController = new AbortController();
    res.on('close', () => abortController.abort());

    try {
      let generator: AsyncGenerator<any>;
      switch (mode) {
        case 'review': generator = this.collabService.review(query, models, abortController.signal); break;
        case 'divide': generator = this.collabService.divide(query, abortController.signal); break;
        default: generator = this.collabService.debate(query, models, abortController.signal);
      }

      for await (const chunk of generator) {
        if (abortController.signal.aborted) break;
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`);
    }

    res.end();
  }
}
