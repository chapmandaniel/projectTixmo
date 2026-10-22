FROM node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS base
WORKDIR /app
RUN apk add --no-cache openssl
ENV CI=true

FROM base AS build
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY scripts/build.cjs ./scripts/build.cjs
COPY src ./src
RUN npm run build

FROM base AS production-dependencies
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci --omit=dev --omit=optional --no-audit --no-fund \
    && ./node_modules/.bin/prisma generate \
    && npm cache clean --force

FROM base AS production
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations
COPY prisma/bootstrap-owner.js prisma/rotate-account-credentials.js prisma/reconcile-approval-reminders.js prisma/reconcile-ticket-inventory.js prisma/rekey-asset-shares.js ./prisma/
COPY scripts/stripe-read-probe.cjs ./scripts/stripe-read-probe.cjs
COPY prisma/check-asset-share-links.js ./prisma/check-asset-share-links.js
RUN mkdir -p logs tmp && chown node:node logs tmp
USER node
EXPOSE 3000
CMD ["sh", "-c", "npm run migrate && exec node dist/index.js"]
