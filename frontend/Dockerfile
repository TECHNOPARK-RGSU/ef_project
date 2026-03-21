ARG NODE_BASE_IMAGE=public.ecr.aws/bitnami/node:22

FROM ${NODE_BASE_IMAGE} AS build

WORKDIR /app

RUN npm install -g bun@1.3.4

COPY bun.lock package.json bunfig.toml tsconfig.json build.ts ./
COPY components.json ./
COPY styles ./styles
COPY src ./src

RUN bun install --frozen-lockfile
RUN bun run build.ts

FROM ${NODE_BASE_IMAGE}

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

COPY --from=build /app/dist ./dist
COPY serve.mjs ./serve.mjs

EXPOSE 8080

CMD ["node", "/app/serve.mjs"]
