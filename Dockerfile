FROM node:18-alpine

# Install shadow package for usermod/groupmod support, su-exec, tzdata, and Chromium for Puppeteer
RUN apk add --no-cache shadow su-exec tzdata \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Configure Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy server and static files
COPY server.js ./
COPY logger.js ./
COPY public/ ./public/
COPY services/ ./services/

# Create entrypoint script to handle PUID, PGID, and UMASK
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create data directory
RUN mkdir -p /data

# Create logs directory
RUN mkdir -p /data/logs

# Expose port
EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
