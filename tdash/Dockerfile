# Stage 1: Base image with dependencies
FROM node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Stage 2: Development
FROM base AS dev
COPY . .
CMD ["npm", "run", "dev", "--", "--host"]

# Stage 3: Build for production
FROM base AS builder
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 4: Serve with Nginx
FROM nginx:alpine@sha256:df221db836e1754089190208cee7eeda94f233197056426eda74a43ab1abeac2 AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
COPY nginx.site.conf /etc/nginx/conf.d/default.conf
COPY nginx.security-headers.conf /etc/nginx/security-headers.conf
COPY docker-entrypoint.d/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
