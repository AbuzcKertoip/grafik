
# Base image
FROM node:20-alpine AS base

# Install dependencies globally (if needed for all stages)
RUN apk add --no-cache libc6-compat openssl

# 1. Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i; \
  else echo "Lockfile not found." && exit 1; \
  fi

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED 1

# Create a template database with schema for the build (needed for static page generation)
# and also to serve as a template for first-run initialization
# NOTE: Must use absolute path because Prisma resolves relative paths from schema.prisma location
ENV DATABASE_URL="file:/app/prisma/template.db"
RUN npx prisma db push

# Build the project
RUN npm run build

# 3. Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Install su-exec for dropping privileges in entrypoint
RUN apk add --no-cache su-exec

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Create the data directory for mounted volume
RUN mkdir -p /app/prisma/data && chown nextjs:nodejs /app/prisma/data

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy the template database (with schema, no data) for first-run initialization
COPY --from=builder --chown=nextjs:nodejs /app/prisma/template.db /app/prisma/template.db

# Copy and set up the entrypoint script
COPY --chown=nextjs:nodejs entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Set the DATABASE_URL for runtime (overridden by docker-compose environment)
ENV DATABASE_URL="file:/app/prisma/data/dev.db"

# NOTE: We do NOT set USER nextjs here because entrypoint.sh
# needs root to fix volume permissions, then drops to nextjs via su-exec

EXPOSE 3000

ENV PORT 3000
# set hostname to localhost
ENV HOSTNAME "0.0.0.0"

# Use entrypoint script instead of direct CMD
# It initializes the DB on first run, then starts the server
ENTRYPOINT ["/app/entrypoint.sh"]
