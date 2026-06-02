# LLM Gather (MVP)

A NestJS-based LLM aggregation platform with OpenAI-compatible endpoints.

## Project structure

- `src/`: backend NestJS application

## Features in current iteration

- OpenAI-compatible `POST /v1/chat/completions`
- OpenAI-compatible `GET /v1/models`
- Optional platform API key authentication (`x-api-key` or `Authorization: Bearer`)
- Automatic `x-request-id` propagation and access logs
- Provider routing by model naming convention
  - `qwen/<model>` -> Qwen provider
  - `glm/<model>` -> GLM provider
  - `mimo/<model>` -> Xiaomi provider (optional)
- Streaming passthrough via SSE
- Provider timeout/retry for transient failures (`429` and `5xx`)

## Quick start

1. Install dependencies

```bash
npm install
```

2. Configure environment (MySQL required)

```bash
cp .env.example .env
```

Ensure MySQL is running and the connection details in `.env` are correct.

3. Start development server

```bash
npm run start:dev
```

## API examples

### List models

```bash
curl http://localhost:3000/v1/models
```

### Chat completion (non-stream)

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen/qwen-plus",
    "messages": [{"role":"user","content":"Hello"}],
    "stream": false
  }'
```

### Chat completion (stream)

```bash
curl http://localhost:3000/v1/chat/completions \
  -N \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen/qwen-plus",
    "messages": [{"role":"user","content":"Hello"}],
    "stream": true
  }'
```

## Notes

- Xiaomi provider is disabled by default and should only be enabled after valid endpoint and key are configured.
- GLM provider uses Aliyun Bailian compatible API by default and is enabled by default.
- You can set `GLM_API_KEY`, or reuse `QWEN_API_KEY` as fallback.
- Set `REQUIRE_PLATFORM_API_KEY=true` if you want to enforce platform key authentication.
- Billing and quota are intentionally out of scope in this MVP iteration.

## Runtime behavior

- The service always returns `x-request-id` in response headers.
- You can pass your own `x-request-id`; otherwise one is generated automatically.
- Provider requests retry on `429` and `5xx` up to configured retry count.
