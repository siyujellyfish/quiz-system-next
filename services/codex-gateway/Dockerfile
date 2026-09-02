FROM node:24-bookworm-slim

ARG CODEX_VERSION=latest

RUN npm install --global "@openai/codex@${CODEX_VERSION}"

WORKDIR /app

COPY server.mjs ./server.mjs

ENV PORT=8787
ENV CODEX_DATA_DIR=/data/codex-users

RUN mkdir -p /data/codex-users \
	&& chown -R node:node /data /app

USER node

EXPOSE 8787
VOLUME ["/data/codex-users"]

CMD ["node", "server.mjs"]
