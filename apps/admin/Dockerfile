FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/ packages/
COPY apps/admin/ apps/admin/
RUN npm ci --workspace @tuti/admin --include-workspace-root
RUN npm run build -w @tuti/admin

FROM nginx:alpine
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null || echo "Using default nginx config"
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
