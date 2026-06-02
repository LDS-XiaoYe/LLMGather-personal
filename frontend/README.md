# Frontend

React + Vite console for the LLM Gather backend.

## Development

1. Install dependencies

```bash
npm install
```

2. Start the dev server

```bash
npm run dev
```

The dev server proxies `/v1/*` to `http://127.0.0.1:3000`.

## Notes

- Default backend base URL is `/v1` so the proxy works out of the box.
- Update `VITE_BACKEND_BASE_URL` if you want to target another backend host.
- Frontend does not need to send platform API key when backend keeps `REQUIRE_PLATFORM_API_KEY=false`.
