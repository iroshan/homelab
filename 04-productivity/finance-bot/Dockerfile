# Stage 1 — install production dependencies (better-sqlite3 native build on ARM64)
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Stage 2 — lean runtime image
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    mkdir -p /app/data /app/exports && \
    chown 1001:1001 /app /app/data /app/exports

COPY --from=builder --chown=1001:1001 /app/node_modules ./node_modules
COPY --chown=1001:1001 package.json ./
COPY --chown=1001:1001 src/ ./src/

USER 1001:1001

HEALTHCHECK --interval=60s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1

CMD ["node", "src/index.js"]
