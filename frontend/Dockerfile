FROM oven/bun:1.3.4 AS build

WORKDIR /app

COPY bun.lock package.json bunfig.toml tsconfig.json build.ts ./
COPY components.json ./
COPY styles ./styles
COPY src ./src

RUN bun install --frozen-lockfile
RUN bun run build.ts

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
