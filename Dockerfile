# Shared workspace dependencies: install once for both application builds.
FROM node:18-alpine AS dependencies
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/api/prisma ./packages/api/prisma
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev --no-audit --no-fund --fetch-retries=2 --fetch-timeout=60000

FROM dependencies AS shared-builder
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@restaurant/shared

FROM shared-builder AS api-builder
COPY packages/api ./packages/api
RUN npm run build --workspace=@restaurant/api

FROM shared-builder AS web-builder
ENV NEXT_IGNORE_INCORRECT_LOCKFILE=1
ENV NEXT_TELEMETRY_DISABLED=1
COPY packages/web ./packages/web
RUN npm run build --workspace=@restaurant/web

FROM dependencies AS api-production
ENV NODE_ENV=production
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=api-builder /app/packages/api/dist ./packages/api/dist
CMD ["node", "packages/api/dist/index.js"]

FROM dependencies AS web-production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=web-builder /app/packages/web/.next ./packages/web/.next
COPY --from=web-builder /app/packages/web/public ./packages/web/public
CMD ["npm", "start", "--workspace=@restaurant/web"]
