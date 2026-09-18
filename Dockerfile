# Railway-compatible: single stage, web-only.
# Railway validates Dockerfiles that have exactly one CMD and no ambiguous
# multi-stage targets. We build the web app here; the API is deployed separately
# (or not at all for staging).
FROM node:18-alpine AS web
RUN apk add --no-cache openssl
WORKDIR /app

# Install workspace deps (shared + api + web) once.
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/api/prisma ./packages/api/prisma
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev --no-audit --no-fund --fetch-retries=2 --fetch-timeout=60000

# Build shared lib first (web depends on it).
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@restaurant/shared

# Build web app.
COPY packages/web ./packages/web
ENV NEXT_IGNORE_INCORRECT_LOCKFILE=1
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# NEXT_PUBLIC_* values are inlined at build time by Next's bundler; they must
# be passed as build args (not runtime env) because they're baked into the
# client bundle (packages/web/src/lib/api.ts, src/app/pricing/page.tsx).
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SALES_EMAIL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SALES_EMAIL=$NEXT_PUBLIC_SALES_EMAIL
RUN npm run build --workspace=@restaurant/web

# Serve the built Next.js app.
CMD ["npm", "start", "--workspace=@restaurant/web"]
