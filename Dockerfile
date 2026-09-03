FROM node:20-alpine

# Install FFmpeg only
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Install dependencies first for better Docker layer caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy application
COPY . .

# Railway provides PORT automatically
ENV NODE_ENV=production

EXPOSE 4000

CMD ["npm", "start"]
