FROM node:20-alpine

RUN apk add --no-cache \
    ffmpeg \
    fontconfig \
    ttf-dejavu

WORKDIR /app

COPY . .

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
