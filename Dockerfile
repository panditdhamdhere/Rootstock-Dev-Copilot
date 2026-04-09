FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps ./apps
COPY packages ./packages
COPY tsconfig.base.json ./
COPY eslint.config.js ./
COPY vitest.config.ts ./
RUN npm ci

FROM base AS runner
ENV NODE_ENV=production
CMD ["npm", "run", "start", "--", "show me the last 5 peg-in transactions on testnet"]
