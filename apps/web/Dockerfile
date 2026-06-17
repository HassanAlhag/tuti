FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/ packages/
COPY apps/web/ apps/web/
RUN npm ci --workspace @tuti/web --include-workspace-root
RUN npm run build -w @tuti/web

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null || echo "Using default nginx config"
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
