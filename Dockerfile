# --- STAGE 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code and configuration files
COPY . .

# Run SvelteKit build and compile Fastify backend
RUN npm run build

# --- STAGE 2: Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/reliability.db

# Copy package descriptors
COPY package.json package-lock.json ./

# Install only production dependencies (no devDependencies, keeps size tiny)
RUN npm ci --omit=dev

# Copy compiled assets from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/migrations ./src/db/migrations

# Expose database volume path for persistence
RUN mkdir -p /app/data
VOLUME /app/data

# Expose server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/v1/health').then(r => r.json()).then(j => process.exit(j.success ? 0 : 1)).catch(() => process.exit(1))"

# Start the unified Fastify + SvelteKit server
CMD ["node", "dist/server.js"]
