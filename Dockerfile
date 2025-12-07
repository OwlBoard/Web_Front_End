# Stage 1: Dependencies
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy only necessary files for build (improves cache)
COPY package.json package-lock.json ./
COPY next.config.ts tsconfig.json ./
COPY public ./public
COPY src ./src

# Accept build args for NEXT_PUBLIC_* environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_USER_SERVICE_URL
ARG NEXT_PUBLIC_COMMENTS_SERVICE_URL
ARG NEXT_PUBLIC_CHAT_SERVICE_URL
ARG NEXT_PUBLIC_CANVAS_SERVICE_URL

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Skip type checking and linting (already configured in next.config.ts)
ENV SKIP_ENV_VALIDATION=1

# Pass NEXT_PUBLIC_* vars to the build (baked into static bundle)
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_USER_SERVICE_URL=${NEXT_PUBLIC_USER_SERVICE_URL}
ENV NEXT_PUBLIC_COMMENTS_SERVICE_URL=${NEXT_PUBLIC_COMMENTS_SERVICE_URL}
ENV NEXT_PUBLIC_CHAT_SERVICE_URL=${NEXT_PUBLIC_CHAT_SERVICE_URL}
ENV NEXT_PUBLIC_CANVAS_SERVICE_URL=${NEXT_PUBLIC_CANVAS_SERVICE_URL}

# Build Next.js application
RUN npm run build

# Stage 3: Runner (Production)
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install ca-certificates package to enable custom CA trust
# Install su-exec to drop privileges in entrypoint script
RUN apk add --no-cache ca-certificates su-exec

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set correct permissions
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start Next.js server directly
CMD ["node", "server.js"]
