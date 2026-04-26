# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22.13.0

# ---- deps ----
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi

# ---- dev (used by docker-compose.dev.yml) ----
FROM node:${NODE_VERSION}-alpine AS dev
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=development HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["pnpm", "dev", "-p", "3000"]

# ---- builder ----
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- runner ----
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/db/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/db/migrate.ts ./migrate.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tsx ./node_modules/tsx
USER nextjs
EXPOSE 3000
# Run migrations before starting the server
CMD sh -c "node ./node_modules/tsx/dist/cli.mjs ./migrate.ts && exec node server.js"
