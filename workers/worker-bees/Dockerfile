# Use Node.js 20 Alpine for a small footprint
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY src ./src

# Build the project
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Start the application
CMD ["node", "dist/index.js"]
