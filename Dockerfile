# Railway-compatible Dockerfile.
# Railway validates Dockerfiles with a single CMD and no ambiguous multi-stage
# targets. This build produces the web app; the API can be deployed separately.
FROM node:18-alpine
RUN apk add --no-cache openssl
WORKDIR /app

# Install dependencies (shared + api + web monorepo).
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/api/prisma ./packages/api/prisma
RUN npm ci --include=dev --no-audit --no-fund --fetch-retries=2 --fetch-timeout=60000

# Build shared library first (web depends on it).
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@restaurant/shared

# Build web app.
COPY packages/web ./packages/web
ENV NEXT_IGNORE_INCORRECT_LOCKFILE=1
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# NEXT_PUBLIC_* values are baked into the client bundle at build time, so they
# must be passed as build args (not runtime env). Rebuild whenever the public
# origin changes.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SALES_EMAIL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SALES_EMAIL=$NEXT_PUBLIC_SALES_EMAIL
RUN npm run build --workspace=@restaurant/web

# Start the Next.js production server.
CMD ["npm", "start", "--workspace=@restaurant/web"]

