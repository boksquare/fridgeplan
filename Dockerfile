# syntax=docker/dockerfile:1

# --- all dependencies (for building) ----------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- production dependencies (for the runtime image) ------------------------
# The Prisma CLI and dotenv are runtime dependencies because the entrypoint
# applies migrations before the server starts.
FROM node:22-alpine AS proddeps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- build ------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT_STANDALONE=true
RUN npm run build

# --- runtime ----------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001

COPY --from=proddeps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# Migrations plus what the Prisma CLI needs to find them at boot.
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=nextjs:nodejs /app/package.json ./package.json
# The generated Prisma client. The server bundle inlines it, but `prisma db
# seed` runs prisma/seed.ts through tsx at runtime and imports it from here.
COPY --from=build --chown=nextjs:nodejs /app/src/generated ./src/generated
# Maintenance scripts run inside the container, e.g. `npm run purge:provider`.
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
