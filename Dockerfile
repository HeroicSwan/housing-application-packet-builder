FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV SYSTEM_DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV DATA_MODE=synthetic
ENV SESSION_SECRET=build-only-session-secret-not-used-at-runtime
ENV ENABLE_DEMO_LOGIN=false
ENV ENFORCE_PRODUCTION_CONFIG=false
COPY . .
RUN npm run db:generate:production && npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client ca-certificates && rm -rf /var/lib/apt/lists/* && groupadd --system app && useradd --system --gid app app
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
RUN mkdir -p /app/.data/storage /app/prisma && chown -R app:app /app
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "--conditions=react-server", "--import", "tsx", "scripts/start-production.ts"]
