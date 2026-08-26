# Multi-stage build for Restaurant Management System

# Stage 1: Build shared types
FROM node:18-alpine AS shared-builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
RUN npm install
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@restaurant/shared

# Stage 2: Build API
FROM node:18-alpine AS api-builder
WORKDIR /app
COPY package*.json ./
COPY packages/api/package.json ./packages/api/
RUN npm install
COPY packages/api ./packages/api
COPY --from=shared-builder /app/packages/shared ./packages/shared
RUN npm run build --workspace=@restaurant/api

# Stage 3: Build Web
FROM node:18-alpine AS web-builder
WORKDIR /app
COPY package*.json ./
COPY packages/web/package.json ./packages/web/
RUN npm install
COPY packages/web ./packages/web
COPY --from=shared-builder /app/packages/shared ./packages/shared
RUN npm run build --workspace=@restaurant/web

# Stage 4: Production API
FROM node:18-alpine AS api-production
WORKDIR /app
COPY package*.json ./
COPY packages/api/package.json ./packages/api/
RUN npm install --production
COPY --from=api-builder /app/packages/api/dist ./packages/api/dist
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
CMD ["node", "packages/api/dist/index.js"]

# Stage 5: Production Web
FROM node:18-alpine AS web-production
WORKDIR /app
COPY --from=web-builder /app/packages/web/.next ./packages/web/.next
COPY --from=web-builder /app/packages/web/public ./packages/web/public
COPY --from=web-builder /app/packages/web/package.json ./packages/web/
COPY --from=web-builder /app/node_modules ./node_modules
CMD ["npm", "start", "--workspace=@restaurant/web"]
