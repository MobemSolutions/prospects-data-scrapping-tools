# Image simple (pas de sortie "standalone") : plus grosse mais plus fiable
# pour un outil interne a usage ponctuel, et evite les soucis de tracing
# standalone avec le CLI Prisma et les binaires natifs @libsql/*.
FROM node:24-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/app/generated ./app/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

# Applique les migrations sur la base montee (volume "data") avant de demarrer.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
