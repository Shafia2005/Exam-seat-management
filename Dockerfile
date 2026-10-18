# Production image: docker build -t seatguard .
# Run migrations with the `migrate` target (see docker-compose.yml, profile "app").

FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Scripts are skipped (husky needs a git checkout); the Prisma client is generated explicitly.
RUN npm ci --ignore-scripts && npx prisma generate

FROM node:20-alpine AS build
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
# NEXT_PUBLIC_* values are baked into the browser bundle at build time.
ARG NEXT_PUBLIC_DEFAULT_ORG_SLUG=""
ARG NEXT_PUBLIC_ENABLE_DEMO_LOGIN="false"
ENV NEXT_PUBLIC_DEFAULT_ORG_SLUG=$NEXT_PUBLIC_DEFAULT_ORG_SLUG \
    NEXT_PUBLIC_ENABLE_DEMO_LOGIN=$NEXT_PUBLIC_ENABLE_DEMO_LOGIN
RUN npm run build

# Has the full toolchain: used to run `prisma migrate deploy` (and, for demos, the seed).
FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
