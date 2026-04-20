FROM node:24-bullseye AS base
WORKDIR /app

ENTRYPOINT [ ]

RUN npm install -g pnpm

FROM base AS builder

COPY ./package.json ./pnpm-lock.yaml ./pnpm-workspace.yaml /app/
RUN pnpm install --frozen

FROM builder AS sourced
COPY . /app/

FROM sourced AS test
RUN pnpm exec playwright install chromium --with-deps

FROM sourced AS app
RUN pnpm run build

FROM test AS tester
COPY . /app/
