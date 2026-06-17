FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/ packages/
COPY apps/seller/ apps/seller/
RUN npm ci --workspace @tuti/seller --include-workspace-root
RUN npm run build -w @tuti/seller

FROM nginx:alpine
COPY --from=build /app/apps/seller/dist /usr/share/nginx/html
COPY apps/seller/nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null || echo "Using default nginx config"
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
