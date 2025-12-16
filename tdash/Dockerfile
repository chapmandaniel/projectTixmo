# Stage 1: Base image with dependencies
FROM node:18-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# Stage 2: Development
FROM base AS dev
COPY . .
CMD ["npm", "run", "dev", "--", "--host"]

# Stage 3: Build for production
FROM base AS builder
COPY . .
RUN npm run build

# Stage 4: Serve with Nginx
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
