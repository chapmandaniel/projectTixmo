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
# Use only the pinned image's matching stable repositories, never edge/mixed branches.
RUN node -e "const fs=require('node:fs');const release=fs.readFileSync('/etc/alpine-release','utf8').trim();const branch=release.split('.').slice(0,2).join('.');for(const line of fs.readFileSync('/etc/apk/repositories','utf8').split(String.fromCharCode(10)).filter(x=>x&&!x.startsWith('#'))){const u=new URL(line);if(u.protocol!=='https:'||!['main','community'].some(repo=>u.pathname.endsWith('/v'+branch+'/'+repo)))throw Error('Stable Alpine repositories required');}console.log('Alpine '+release);" \
    && apk add --no-cache postgresql18-client \
    && pg_dump --version | grep -E '^pg_dump \(PostgreSQL\) 18\.' \
    && pg_restore --version | grep -E '^pg_restore \(PostgreSQL\) 18\.' \
    && psql --version | grep -E '^psql \(PostgreSQL\) 18\.'
COPY package.json package-lock.json ./
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations
COPY prisma/bootstrap-owner.js prisma/rotate-account-credentials.js prisma/reconcile-approval-reminders.js prisma/reconcile-ticket-inventory.js prisma/rekey-asset-shares.js ./prisma/
COPY scripts/start-api.sh ./scripts/start-api.sh
COPY scripts/stripe-read-probe.cjs ./scripts/stripe-read-probe.cjs
COPY scripts/runtime-version-probe.cjs ./scripts/runtime-version-probe.cjs
COPY scripts/approved-email-once.cjs ./scripts/approved-email-once.cjs
COPY scripts/storage-canary.cjs ./scripts/storage-canary.cjs
COPY scripts/backup-rehearsal.cjs ./scripts/backup-rehearsal.cjs
COPY prisma/check-asset-share-links.js ./prisma/check-asset-share-links.js
RUN mkdir -p logs tmp && chown node:node logs tmp
USER node
EXPOSE 3000
CMD ["/bin/sh", "scripts/start-api.sh"]
