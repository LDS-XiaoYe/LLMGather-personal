import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'crypto';
import cookieParser = require('cookie-parser');
import { json, NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { REQUEST_ID_HEADER } from './common/constants';
import { SystemSettingsService } from './common/system-settings.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const frontendOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: frontendOrigins.length === 1 ? frontendOrigins[0] : frontendOrigins,
    credentials: true,
    exposedHeaders: [
      REQUEST_ID_HEADER,
      'x-provider-key-rotation',
      'x-cache-hit',
      'x-cache-tokens-saved',
      'x-credit-balance',
    ],
  });
  // JSON body size limit from system settings (bytes). fallback to 2mb.
  let jsonLimit = '2mb';
  try {
    const settings = app.get(SystemSettingsService);
    const maxJson = settings.getNumber('max_json_body_size', NaN);
    if (Number.isFinite(maxJson) && maxJson > 0) {
      jsonLimit = `${maxJson}b`;
    }
  } catch (e) {
    // ignore — use default
  }
  app.use(json({ limit: jsonLimit }));
  app.use(cookieParser());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const incomingRequestId = req.header(REQUEST_ID_HEADER);
    const requestId = incomingRequestId || randomUUID();
    const startedAt = Date.now();

    res.setHeader(REQUEST_ID_HEADER, requestId);

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      console.log(
        JSON.stringify({
          request_id: requestId,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          duration_ms: durationMs,
        }),
      );
    });

    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('v1');

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
}

bootstrap();
