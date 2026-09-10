# Multi-stage build for Restaurant Management System

# Stage 1: Build shared types
FROM node:18-alpine AS shared-builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
RUN npm ci
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@restaurant/shared

# Stage 2: Build API
FROM node:18-alpine AS api-builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/api/prisma ./packages/api/prisma
RUN npm ci
COPY packages/api ./packages/api
COPY --from=shared-builder /app/packages/shared ./packages/shared
RUN npx prisma generate --schema=packages/api/prisma/schema.prisma && npm run build --workspace=@restaurant/api

# Stage 3: Build Web
FROM node:18-alpine AS web-builder
WORKDIR /app
ENV NEXT_IGNORE_INCORRECT_LOCKFILE=1
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
COPY packages/web/package.json ./packages/web/
RUN npm ci
COPY packages/web ./packages/web
COPY --from=shared-builder /app/packages/shared ./packages/shared
RUN npm run build --workspace=@restaurant/web

# Stage 4: Production API
FROM node:18-alpine AS api-production
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/
COPY --from=api-builder /app/packages/api/prisma ./packages/api/prisma
RUN npm ci
RUN npx prisma generate --schema=packages/api/prisma/schema.prisma
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=api-builder /app/packages/api/dist ./packages/api/dist
CMD ["node", "packages/api/dist/index.js"]

# Stage 5: Production Web
FROM node:18-alpine AS web-production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=web-builder /app/packages/web/.next ./packages/web/.next
COPY --from=web-builder /app/packages/web/public ./packages/web/public
CMD ["npm", "start", "--workspace=@restaurant/web"]