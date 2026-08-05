FROM node:20-bookworm-slim AS build

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm install --no-audit --no-fund

COPY . .

ARG VITE_API_BASE_URL=
ARG VITE_APP_ENV=production

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_APP_ENV=${VITE_APP_ENV}

RUN npm run build

FROM nginx:1.27-alpine

ENV NODE_ENV=production

# openssl is required by docker-entrypoint.sh to bootstrap a temporary
# self-signed certificate on first boot (before Let's Encrypt provisioning).
RUN apk add --no-cache openssl

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]