# Use Node.js 20 Alpine for a small footprint
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including devDependencies for build)
RUN npm install

# Copy source code (Force Rebuild 2026-02-18)
COPY src ./src

# Build the project
RUN npm run build && ls -R /app/dist || echo "Build failed or dist empty"

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Install git (Required for CodingHandler)
RUN apk add --no-cache git

# Install git (Required for CodingHandler)
RUN apk add --no-cache git

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Start the application
CMD ["node", "dist/index.js"]
