FROM node:18-alpine

WORKDIR /app

ENV HOST=localhost
ENV PORT=5005

COPY . /app

RUN apk add --no-cache curl && \
  mkdir cache && \
  chown -R node:node static cache && \
  npm install -g npm@latest && \
  npm install --omit=dev && \
  rm -rf /tmp/* /root/.npm

EXPOSE ${PORT}

USER node

HEALTHCHECK --interval=1m --timeout=2s \
  CMD curl -LSfs http://${HOST}:${PORT}/zones || exit 1

CMD ["npm", "start"]
