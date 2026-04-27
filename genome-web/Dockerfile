# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22.20.0

# ---- deps ----
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
ENV COREPACK_INTEGRITY_KEYS=0
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi

# ---- dev ----
FROM node:${NODE_VERSION}-alpine AS dev
WORKDIR /app
ENV COREPACK_INTEGRITY_KEYS=0
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=development HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["pnpm", "dev", "-p", "3000"]

# ---- builder ----
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
ENV COREPACK_INTEGRITY_KEYS=0
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build
# Bundle migrate.ts into a self-contained JS file so the runner does not need tsx/esbuild.
RUN pnpm exec esbuild src/lib/db/migrate.ts \
      --bundle --platform=node --target=node22 --format=cjs \
      --outfile=migrate.cjs

# ---- runner ----
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/db/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/migrate.cjs ./migrate.cjs
USER nextjs
EXPOSE 3000
CMD sh -c "node ./migrate.cjs && exec node server.js"
