# ── Build stage ──
FROM node:22-alpine AS build
WORKDIR /app

# Copy workspace config first for npm install
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

RUN npm install

# Copy full source
COPY backend/ backend/

# Build backend only
RUN npm run build:backend

# ── Production stage ──
FROM node:22-alpine

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json

ENV NODE_PATH=/app/node_modules
ENV NODE_ENV=production

WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]
