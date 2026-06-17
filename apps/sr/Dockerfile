FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/ packages/
COPY apps/sr/ apps/sr/
RUN npm ci --workspace @tuti/sr --include-workspace-root
RUN npm run build -w @tuti/sr

FROM nginx:alpine
COPY --from=build /app/apps/sr/dist /usr/share/nginx/html
COPY apps/sr/nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null || echo "Using default nginx config"
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
