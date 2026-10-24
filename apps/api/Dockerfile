# API Turmei — build a partir da raiz do monorepo:
#   docker build -f apps/api/Dockerfile -t turmei-api .
FROM node:25-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @turmei/api...
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @turmei/contracts build && pnpm --filter @turmei/api build
RUN pnpm --filter @turmei/api deploy --prod /out

FROM node:25-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 3200
# As migrations rodam na subida (migrationsRun); TYPEORM_SYNC fica desligado em produção.
CMD ["node", "dist/main"]
