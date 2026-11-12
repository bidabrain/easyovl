FROM node:22-alpine

# docker CLI + compose plugin: the manager drives the host Docker daemon
# through the mounted /var/run/docker.sock
RUN apk add --no-cache docker-cli docker-cli-compose tar

WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY lib ./lib
COPY public ./public

ENV DATA_DIR=/data \
    PORT=8090 \
    NODE_ENV=production

EXPOSE 8090
CMD ["node", "server.js"]
