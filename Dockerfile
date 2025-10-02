# Multi-stage build for production deployment
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL deps (including devDependencies) for build
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the React application
RUN npm run build


# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy package.json to install runtime dependencies
COPY package*.json ./

# Install only production dependencies (express, cors, dotenv, etc.)
RUN npm ci --only=production --legacy-peer-deps

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy build output
COPY --from=builder /app/dist ./dist

# Copy server files
COPY server ./server
COPY sql ./sql

# Ensure folders exist (volumes will override them)
RUN mkdir -p /app/uploads /app/config

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

RUN chown -R appuser:nodejs /app
USER appuser

EXPOSE 3000

# Start the server (serves both API and React app)
CMD ["node", "server/index.js"]
