FROM node:20-bookworm-slim

# Install FFmpeg
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ffmpeg \
       fonts-dejavu \
       fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/data /app/uploads

ENV NODE_ENV=production

EXPOSE 8080

CMD ["npm", "start"]
