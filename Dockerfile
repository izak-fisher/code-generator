FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --production

COPY src/ src/
COPY config/ config/

EXPOSE 8002

CMD ["bun", "src/index.js"]
