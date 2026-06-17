FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/ packages/
COPY apps/driver/ apps/driver/
RUN npm ci --workspace @tuti/driver --include-workspace-root
RUN npm run build -w @tuti/driver

FROM nginx:alpine
COPY --from=build /app/apps/driver/dist /usr/share/nginx/html
COPY apps/driver/nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null || echo "Using default nginx config"
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
