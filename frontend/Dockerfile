ARG NODE_BASE_IMAGE=public.ecr.aws/docker/library/node:22-alpine
ARG NGINX_BASE_IMAGE=public.ecr.aws/nginx/nginx:alpine
FROM ${NODE_BASE_IMAGE} AS build

WORKDIR /app

RUN npm install -g bun@1.3.4

COPY bun.lock package.json bunfig.toml tsconfig.json build.ts ./
COPY components.json ./
COPY styles ./styles
COPY src ./src

RUN bun install --frozen-lockfile
RUN bun run build.ts

FROM ${NGINX_BASE_IMAGE}

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
