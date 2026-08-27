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
WORKDIR /app
COPY package*.json ./
COPY packages/api/package.json ./packages/api/
# postinstall runs `prisma generate` (sandbox dev machines may skip lifecycle
# scripts, CI/builders must not); a second explicit generate is harmless.
RUN npm ci
COPY packages/api ./packages/api
COPY --from=shared-builder /app/packages/shared ./packages/shared
RUN npx prisma generate && npm run build --workspace=@restaurant/api

# Stage 3: Build Web
FROM node:18-alpine AS web-builder
WORKDIR /app
COPY package*.json ./
COPY packages/web/package.json ./packages/web/
RUN npm ci
COPY packages/web ./packages/web
COPY --from=shared-builder /app/packages/shared ./packages/shared
RUN npm run build --workspace=@restaurant/web

# Stage 4: Production API
#
# ⚠️ Deliberately keeps devDependencies installed: the `prisma` CLI lives in
# devDependencies and .prisma/client only exists after generation. A pure
# `npm install --production` here shipped an API image that crashed on boot.
FROM node:18-alpine AS api-production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY packages/api/package.json ./packages/api/
RUN npm ci
COPY --from=api-builder /app/packages/api/prisma ./packages/api/prisma
RUN cd packages/api && npx prisma generate
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=api-builder /app/packages/api/dist ./packages/api/dist
CMD ["node", "packages/api/dist/index.js"]

# Stage 5: Production Web
FROM node:18-alpine AS web-production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=web-builder /app/node_modules ./node_modules
COPY --from=web-builder /app/packages/web/.next ./packages/web/.next
COPY --from=web-builder /app/packages/web/public ./packages/web/public
COPY --from=web-builder /app/packages/web/package.json ./packages/web/
CMD ["npm", "start", "--workspace=@restaurant/web"]
