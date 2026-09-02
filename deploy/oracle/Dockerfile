FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY bot ./bot
COPY src ./src
COPY tsconfig.json ./

RUN mkdir -p public/uploads/matches \
  && chown -R node:node /app

USER node
ENV NODE_ENV=production
CMD ["npm", "run", "bot"]
